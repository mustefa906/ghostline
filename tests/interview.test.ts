import { describe, expect, it } from "vitest";
import { passesCopyRules } from "../lib/copy-rules";
import {
  DRAFT_SYSTEM_PROMPT,
  buildDraftUserMessage,
  buildInterviewUserMessage,
} from "../lib/prompts";

// The interview caps live in the route, but the rules they enforce are
// checked here against the prompt builders: skipped answers never reach the
// draft, and the draft only ever sees transcript plus answers plus
// fingerprint.

function answersFromTurns(
  turns: { role: string; body: string }[],
): { question: string; answer: string }[] {
  const answers: { question: string; answer: string }[] = [];
  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    if (turn.role !== "agent") continue;
    const next = turns[i + 1];
    if (next && next.role === "founder" && next.body !== "[skipped]") {
      answers.push({ question: turn.body, answer: next.body });
    }
  }
  return answers;
}

describe("interview flow rules", () => {
  it("skips a skipped question in the answers sent to the draft", () => {
    const turns = [
      { role: "agent", body: "What went wrong?" },
      { role: "founder", body: "[skipped]" },
      { role: "agent", body: "What changed?" },
      { role: "founder", body: "We gave the first week one owner." },
    ];
    const answers = answersFromTurns(turns);
    expect(answers).toHaveLength(1);
    expect(answers[0].answer).toBe("We gave the first week one owner.");
  });

  it("keeps every answered question in order", () => {
    const turns = [
      { role: "agent", body: "What went wrong?" },
      { role: "founder", body: "Nobody owned the first week." },
      { role: "agent", body: "What changed?" },
      { role: "founder", body: "The next three clients stayed." },
    ];
    expect(answersFromTurns(turns)).toHaveLength(2);
  });

  it("builds the interview message from the transcript and the turns", () => {
    const message = buildInterviewUserMessage({
      transcript: "We lost a client.",
      turns: [{ role: "agent", body: "What went wrong?" }],
    });
    expect(message).toContain("We lost a client.");
    expect(message).toContain("Interviewer: What went wrong?");
  });

  it("says plainly when no questions were answered", () => {
    const message = buildDraftUserMessage({
      transcript: "We lost a client.",
      answers: [],
      fingerprint: [],
    });
    expect(message).toContain("No interview answers");
    expect(message).toContain("No past posts were given");
  });
});

describe("draft input rules", () => {
  it("passes only transcript, answers, and fingerprint to the draft", () => {
    const message = buildDraftUserMessage({
      transcript: "We lost a client.",
      answers: [{ question: "What changed?", answer: "One owner." }],
      fingerprint: ["I write short lines."],
    });
    expect(message).toContain("We lost a client.");
    expect(message).toContain("Q: What changed?");
    expect(message).toContain("A: One owner.");
    expect(message).toContain("Post 1:\nI write short lines.");
    expect(message).not.toContain("invent");
  });

  it("labels the transcript as the raw idea and the answers as the facts", () => {
    const message = buildDraftUserMessage({
      transcript: "We lost a client.",
      answers: [{ question: "What changed?", answer: "One owner." }],
      fingerprint: ["I write short lines."],
    });
    expect(message).toContain("Raw idea (voice-note transcript)");
    expect(message).toContain("Facts (interview answers)");
    expect(message).toContain("Goal: reach. Format: auto.");
  });

  it("labels the fingerprint as voice only, never as facts", () => {
    const message = buildDraftUserMessage({
      transcript: "We lost a client.",
      answers: [],
      fingerprint: ["I write short lines."],
    });
    expect(message).toContain("vocabulary only");
  });
});

describe("draft prompt rules", () => {
  it("keeps the truth rule absolute and first", () => {
    expect(DRAFT_SYSTEM_PROMPT).toContain("TRUTH RULE");
    expect(DRAFT_SYSTEM_PROMPT).toContain("Never invent numbers");
    expect(DRAFT_SYSTEM_PROMPT).toContain("[ADD:");
    expect(DRAFT_SYSTEM_PROMPT.indexOf("TRUTH RULE")).toBeLessThan(
      DRAFT_SYSTEM_PROMPT.indexOf("STEP 1"),
    );
  });

  it("asks for three hooks at three widths and picks the best", () => {
    expect(DRAFT_SYSTEM_PROMPT).toContain("WRITE 3 HOOKS");
    expect(DRAFT_SYSTEM_PROMPT).toContain("Broad");
    expect(DRAFT_SYSTEM_PROMPT).toContain("Narrow");
    expect(DRAFT_SYSTEM_PROMPT).toContain("Niche");
    expect(DRAFT_SYSTEM_PROMPT).toContain("rehook");
  });

  it("grades itself with Truth as an automatic fail", () => {
    expect(DRAFT_SYSTEM_PROMPT).toContain("GRADE YOURSELF");
    expect(DRAFT_SYSTEM_PROMPT).toContain("13+ out of 16");
    expect(DRAFT_SYSTEM_PROMPT).toContain("Truth = 2");
    expect(DRAFT_SYSTEM_PROMPT).toContain("automatic fail");
  });

  it("matches the voice from the fingerprint, not from a style reference", () => {
    expect(DRAFT_SYSTEM_PROMPT).toContain(
      "cadence, sentence length, and vocabulary from the fingerprint",
    );
    expect(DRAFT_SYSTEM_PROMPT).toContain(
      "The voice itself comes from the fingerprint",
    );
  });

  it("passes the house copy rules itself", () => {
    expect(passesCopyRules(DRAFT_SYSTEM_PROMPT)).toBe(true);
  });
});
