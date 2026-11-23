import { NextRequest, NextResponse } from "next/server";
import {
  CLAUDE_MODEL,
  getAnthropicClient,
  isMissingKey,
} from "@/lib/anthropic";
import {
  INTERVIEW_SYSTEM_PROMPT,
  MAX_MAIN_QUESTIONS,
  SUMMARY_SYSTEM_PROMPT,
  buildInterviewUserMessage,
} from "@/lib/prompts";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

type Turn = { role: "agent" | "founder"; body: string; kind?: string };

type InterviewReply = {
  kind: "question" | "clarify" | "done";
  text: string;
};

function parseInterviewReply(raw: string): InterviewReply | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as InterviewReply;
    if (
      (parsed.kind === "question" ||
        parsed.kind === "clarify" ||
        parsed.kind === "done") &&
      typeof parsed.text === "string" &&
      parsed.text.trim().length > 0
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function countMainQuestions(turns: Turn[]): number {
  return turns.filter((t) => t.role === "agent" && t.kind !== "clarify")
    .length;
}

function lastAnswerGotClarify(turns: Turn[]): boolean {
  // Walk back from the end: the most recent founder answer is followed by
  // a clarify turn when it already got one.
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].role === "founder") {
      return turns
        .slice(i + 1)
        .some((t) => t.role === "agent" && t.kind === "clarify");
    }
  }
  return false;
}

export async function POST(req: NextRequest) {
  let body: {
    transcript?: string;
    turns?: Turn[];
    mode?: "question" | "summary";
    sessionId?: string;
    lead?: {
      id?: string;
      title?: string;
      whatHappened?: string;
      angle?: string;
      openingQuestion?: string;
      sourceLabel?: string;
    };
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
  const turns: Turn[] = Array.isArray(body.turns) ? body.turns : [];
  const mode = body.mode ?? "question";

  if (!transcript) {
    return NextResponse.json(
      { error: "Add a transcript first, then start the interview." },
      { status: 400 },
    );
  }

  const lead = body.lead;
  const leadContext =
    lead &&
    typeof lead.title === "string" &&
    typeof lead.whatHappened === "string" &&
    typeof lead.angle === "string" &&
    typeof lead.sourceLabel === "string"
      ? {
          title: lead.title,
          whatHappened: lead.whatHappened,
          angle: lead.angle,
          sourceLabel: lead.sourceLabel,
        }
      : undefined;

  // A lead session opens with the lead's own question, with no model call.
  // It runs before the key check on purpose: the question is pre-written.
  if (
    mode === "question" &&
    turns.length === 0 &&
    lead &&
    typeof lead.openingQuestion === "string" &&
    lead.openingQuestion.trim().length > 0
  ) {
    const reply = {
      kind: "question" as const,
      text: lead.openingQuestion.trim(),
    };
    if (body.sessionId) {
      try {
        const store = await getStore();
        await store.addTurn(body.sessionId, "agent", reply.text, reply.kind);
      } catch {
        // The interview still works when persistence fails.
      }
    }
    return NextResponse.json(reply);
  }

  const anthropic = getAnthropicClient();
  if (isMissingKey(anthropic)) {
    return NextResponse.json({ error: anthropic.message }, { status: 503 });
  }
  const client = anthropic.client;

  try {
    if (mode === "summary") {
      const history = turns
        .map((t) => `${t.role === "agent" ? "Interviewer" : "Founder"}: ${t.body}`)
        .join("\n");
      const message = await client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 600,
        system: SUMMARY_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Transcript:\n${transcript}\n\nInterview:\n${history || "No questions were answered."}\n\nWrite the summary.`,
          },
        ],
      });
      const text = message.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();
      return NextResponse.json({ summary: text });
    }

    // Enforce the question caps on the server, whatever the model says.
    const mainAsked = countMainQuestions(turns);
    if (mainAsked >= MAX_MAIN_QUESTIONS) {
      return NextResponse.json({
        kind: "done",
        text: "That is enough. I have what I need.",
      });
    }

    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 400,
      system: INTERVIEW_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildInterviewUserMessage({
            transcript,
            turns,
            lead: leadContext,
          }),
        },
      ],
    });
    const raw = message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    let reply = parseInterviewReply(raw);

    if (!reply) {
      // The model did not return clean JSON. Use the raw text as a question
      // when it reads like one, otherwise end the interview cleanly.
      reply =
        raw.endsWith("?") && raw.length < 300
          ? { kind: "question", text: raw }
          : { kind: "done", text: "That is enough. I have what I need." };
    }

    // Server-side cap enforcement.
    if (reply.kind === "question" && mainAsked >= MAX_MAIN_QUESTIONS) {
      reply = { kind: "done", text: "That is enough. I have what I need." };
    }
    if (
      reply.kind === "clarify" &&
      lastAnswerGotClarify(turns)
    ) {
      reply =
        mainAsked >= MAX_MAIN_QUESTIONS
          ? { kind: "done", text: "That is enough. I have what I need." }
          : {
              kind: "question",
              text: "What is the one lesson from this you would want another founder to hear?",
            };
    }

    // Persist the turn when the client gave us a session to attach it to.
    if (body.sessionId) {
      try {
        const store = await getStore();
        await store.addTurn(body.sessionId, "agent", reply.text, reply.kind);
      } catch {
        // The interview still works when persistence fails.
      }
    }

    return NextResponse.json(reply);
  } catch {
    return NextResponse.json(
      {
        error:
          "The interview hit a snag. Try again, or skip the interview and draft from the transcript alone.",
      },
      { status: 502 },
    );
  }
}
