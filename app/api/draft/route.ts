import { NextRequest, NextResponse } from "next/server";
import {
  CLAUDE_MODEL,
  getAnthropicClient,
  isMissingKey,
} from "@/lib/anthropic";
import { checkCopyRules, repairDashes } from "@/lib/copy-rules";
import { DRAFT_SYSTEM_PROMPT, buildDraftUserMessage } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 90;

type DraftSource = { paragraph: number; source: string; detail: string };

type DraftReply = {
  draft: string;
  plain: string;
  short: string;
  sources: DraftSource[];
};

function parseDraftReply(raw: string): DraftReply | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as DraftReply;
    if (
      typeof parsed.draft === "string" &&
      parsed.draft.trim().length > 0 &&
      typeof parsed.plain === "string" &&
      typeof parsed.short === "string" &&
      Array.isArray(parsed.sources)
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

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
    const message = await anthropic.client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      system: DRAFT_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildDraftUserMessage({ transcript, answers, fingerprint }),
        },
      ],
    });
    const raw = message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    const parsed = parseDraftReply(raw);
    if (!parsed) {
      return NextResponse.json(
        {
          error:
            "The draft came back in a shape the app could not read. Try again.",
        },
        { status: 502 },
      );
    }

    // Mechanical repair for dashes, then a copy-rules check on every version.
    const draft = repairDashes(parsed.draft.trim());
    const plain = repairDashes(parsed.plain.trim());
    const short = repairDashes(parsed.short.trim());
    const violations = [
      ...checkCopyRules(draft),
      ...checkCopyRules(plain),
      ...checkCopyRules(short),
    ];
    if (violations.length > 0) {
      return NextResponse.json(
        {
          error:
            "The draft broke a house writing rule, so it was held back. Try again.",
        },
        { status: 502 },
      );
    }

    const paragraphs = draft
      .split(/\n\s*\n/)
      .filter((p) => p.trim().length > 0).length;
    const sourceNote = sourceNoteFrom(parsed.sources, paragraphs);

    return NextResponse.json({
      draft,
      plain,
      short,
      sources: parsed.sources,
      sourceNote,
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
