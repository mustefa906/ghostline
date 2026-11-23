import { describe, expect, it } from "vitest";
import { passesCopyRules } from "../lib/copy-rules";
import {
  DRAFT_SYSTEM_PROMPT,
  VERIFY_SYSTEM_PROMPT,
  buildDraftUserMessage,
  buildInterviewUserMessage,
  buildVerifyUserMessage,
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

  it("adds the lead as context for questions and leaves it out otherwise", () => {
    const withLead = buildInterviewUserMessage({
      transcript: "We lost a client.",
      turns: [],
      lead: {
        title: "Beta walked away",
        whatHappened: "Beta closed lost after 4 weeks.",
        angle: "The onboarding gap showed up again.",
        sourceLabel: "HubSpot: Beta entered Closed Lost, Thu Nov 19",
      },
    });
    expect(withLead).toContain("Story lead (context for your questions only)");
    expect(withLead).toContain("Beta walked away");
    expect(withLead).toContain("The onboarding gap showed up again.");
    const withoutLead = buildInterviewUserMessage({
      transcript: "We lost a client.",
      turns: [],
    });
    expect(withoutLead).not.toContain("Story lead");
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

describe("verify prompt rules", () => {
  it("checks sentences against the transcript and the answers only", () => {
    expect(VERIFY_SYSTEM_PROMPT).toContain("fact-checker");
    expect(VERIFY_SYSTEM_PROMPT).toContain("voice-note transcript");
    expect(VERIFY_SYSTEM_PROMPT).toContain("interview answers");
    expect(VERIFY_SYSTEM_PROMPT).toContain(
      "is every claim in the sentence supported",
    );
  });

  it("never counts the fingerprint posts as evidence", () => {
    expect(VERIFY_SYSTEM_PROMPT).toContain(
      "They never count as evidence",
    );
  });

  it("names what makes a sentence unsupported", () => {
    expect(VERIFY_SYSTEM_PROMPT).toContain(
      "combines two facts into a new claim",
    );
    expect(VERIFY_SYSTEM_PROMPT).toContain(
      "adds a time, place, number, or name",
    );
    expect(VERIFY_SYSTEM_PROMPT).toContain("changes a number's meaning");
    expect(VERIFY_SYSTEM_PROMPT).toContain("Names and numbers count");
  });

  it("answers with JSON only, one check per sentence", () => {
    expect(VERIFY_SYSTEM_PROMPT).toContain(
      "You answer with JSON only, no other text",
    );
    expect(VERIFY_SYSTEM_PROMPT).toContain('"checks"');
    expect(VERIFY_SYSTEM_PROMPT).toContain('"supported"');
    expect(VERIFY_SYSTEM_PROMPT).toContain('"evidence"');
  });

  it("sends the transcript, the answers, and the draft, and no fingerprint", () => {
    const message = buildVerifyUserMessage({
      transcript: "We lost a client last month.",
      answers: [
        {
          question: "What changed?",
          answer: "We gave the first week one owner.",
        },
      ],
      draft: "We lost a client last month.\n\nOne owner fixed week one.",
    });
    expect(message).toContain("We lost a client last month.");
    expect(message).toContain("Q: What changed?");
    expect(message).toContain("A: We gave the first week one owner.");
    expect(message).toContain("Draft to check:");
    expect(message).toContain("One owner fixed week one.");
    expect(message).not.toContain("fingerprint");
  });

  it("passes the house copy rules itself", () => {
    expect(passesCopyRules(VERIFY_SYSTEM_PROMPT)).toBe(true);
  });
});
