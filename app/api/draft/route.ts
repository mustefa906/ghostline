import { NextRequest, NextResponse } from "next/server";
import {
  CLAUDE_MODEL,
  getAnthropicClient,
  isMissingKey,
} from "@/lib/anthropic";
import { checkCopyRules, repairDashes } from "@/lib/copy-rules";
import {
  parseDraftReply,
  parseVerifyReply,
  verifyFlags,
  type DraftSource,
} from "@/lib/draft-reply";
import {
  DRAFT_SYSTEM_PROMPT,
  VERIFY_SYSTEM_PROMPT,
  buildDraftUserMessage,
  buildVerifyUserMessage,
} from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 90;

function sourceNoteFrom(sources: DraftSource[], paragraphs: number): string {
  if (!sources.length) {
    return "Every paragraph came from the voice-note transcript and the interview answers.";
  }
  const byParagraph = new Map<number, DraftSource>();
  for (const s of sources) byParagraph.set(s.paragraph, s);
  const lines: string[] = [];
  for (let i = 1; i <= paragraphs; i++) {
    const s = byParagraph.get(i);
    if (s) {
      lines.push(`Paragraph ${i} came from the ${s.source}: ${s.detail}.`);
    }
  }
  return lines.length
    ? lines.join(" ")
    : "Every paragraph came from the voice-note transcript and the interview answers.";
}

export async function POST(req: NextRequest) {
  let body: {
    transcript?: string;
    answers?: { question: string; answer: string }[];
    fingerprint?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "That request was not valid JSON." },
      { status: 400 },
    );
  }

  const transcript = (body.transcript ?? "").trim();
  const answers = Array.isArray(body.answers) ? body.answers : [];
  const fingerprint = Array.isArray(body.fingerprint) ? body.fingerprint : [];

  if (!transcript) {
    return NextResponse.json(
      { error: "Add a transcript first, then generate a draft." },
      { status: 400 },
    );
  }

  const anthropic = getAnthropicClient();
  if (isMissingKey(anthropic)) {
    return NextResponse.json({ error: anthropic.message }, { status: 503 });
  }

  try {
    // Two attempts at most. A draft that breaks a house rule gets one
    // rewrite with the exact offending line named, so the founder never
    // hits a dead end for a fixable slip. The rule still holds: a draft
    // that breaks it twice is held back.
    let parsed: NonNullable<ReturnType<typeof parseDraftReply>> | null = null;
    let firstRaw = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      const message = await anthropic.client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 3000,
        system: DRAFT_SYSTEM_PROMPT,
        messages:
          attempt === 0
            ? [
                {
                  role: "user",
                  content: buildDraftUserMessage({
                    transcript,
                    answers,
                    fingerprint,
                  }),
                },
              ]
            : [
                {
                  role: "user",
                  content: buildDraftUserMessage({
                    transcript,
                    answers,
                    fingerprint,
                  }),
                },
                { role: "assistant", content: firstRaw },
                {
                  role: "user",
                  content: `That draft broke a house rule: it used a comma followed by the word 'not'. Rewrite the same draft, with the same facts and the same shape, without writing a comma followed by the word 'not'. Answer with JSON only, in the same shape as before.`,
                },
              ],
      });
      const raw = message.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();
      if (attempt === 0) firstRaw = raw;

      const attemptParsed = parseDraftReply(raw);
      if (!attemptParsed) {
        return NextResponse.json(
          {
            error:
              "The draft came back in a shape the app could not read. Try again.",
          },
          { status: 502 },
        );
      }

      // Mechanical repair for dashes, then a copy-rules check on every version.
      const attemptDraft = repairDashes(attemptParsed.draft.trim());
      const attemptPlain = repairDashes(attemptParsed.plain.trim());
      const attemptShort = repairDashes(attemptParsed.short.trim());
      const violations = [
        ...checkCopyRules(attemptDraft),
        ...checkCopyRules(attemptPlain),
        ...checkCopyRules(attemptShort),
      ];
      if (violations.length === 0) {
        parsed = attemptParsed;
        break;
      }
      if (attempt === 1) {
        return NextResponse.json(
          {
            error:
              "The draft broke a house writing rule, so it was held back. Try again.",
          },
          { status: 502 },
        );
      }
    }
    if (!parsed) {
      return NextResponse.json(
        {
          error:
            "The draft came back in a shape the app could not read. Try again.",
        },
        { status: 502 },
      );
    }

    // The loop only keeps a draft that passed the copy check, so the
    // text below is already clean. Repair the dashes once for the reply.
    const draft = repairDashes(parsed.draft.trim());
    const plain = repairDashes(parsed.plain.trim());
    const short = repairDashes(parsed.short.trim());

    // Same dash repair on the new engagement fields. A missing field stays
    // missing; the response drops it instead of failing the draft.
    const idea = parsed.idea ? repairDashes(parsed.idea) : undefined;
    const hooks = parsed.hooks?.map((h) => ({
      ...h,
      text: repairDashes(h.text),
    }));
    const visual = parsed.visual ? repairDashes(parsed.visual) : undefined;
    const scores = parsed.scores?.map((s) => ({
      ...s,
      label: repairDashes(s.label),
    }));
    const blanks = parsed.blanks?.map((b) => repairDashes(b));

    const paragraphs = draft
      .split(/\n\s*\n/)
      .filter((p) => p.trim().length > 0).length;
    const sourceNote = sourceNoteFrom(parsed.sources, paragraphs);

    // A second pass fact-checks the draft against the transcript and the
    // answers. It only flags lines. A flag never blocks the draft, and a
    // failed check leaves the draft exactly as it is.
    let flagged:
      | { sentence: string; evidence: string }[]
      | undefined;
    try {
      const verifyMessage = await anthropic.client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 800,
        system: VERIFY_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: buildVerifyUserMessage({ transcript, answers, draft }),
          },
        ],
      });
      const verifyRaw = verifyMessage.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();
      const flags = verifyFlags(parseVerifyReply(verifyRaw));
      if (flags.length > 0) {
        flagged = flags.map((flag) => ({
          sentence: repairDashes(flag.sentence),
          evidence: repairDashes(flag.evidence),
        }));
      }
    } catch {
      // Verification is best effort. The draft stands without it.
    }

    return NextResponse.json({
      draft,
      plain,
      short,
      sources: parsed.sources,
      sourceNote,
      idea,
      hooks,
      visual,
      scores,
      total: parsed.total,
      blanks,
      flagged,
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Drafting hit a snag. Try again, or keep the transcript and write the post yourself.",
      },
      { status: 502 },
    );
  }
}
