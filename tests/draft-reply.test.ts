import { describe, expect, it } from "vitest";
import { parseDraftReply } from "../lib/draft-reply";

const fullReply = JSON.stringify({
  idea: "The reader will learn that one owner beats a busy week.",
  hooks: [
    { width: "Broad", text: "We lost a client in week one.", picked: true },
    { width: "Narrow", text: "Nobody owned week one.", picked: false },
    { width: "Niche", text: "One owner, three clients stayed.", picked: false },
  ],
  draft: "We lost a client.\n\nNobody owned the first week.",
  plain: "We lost a client. Nobody owned the first week.",
  short: "Nobody owned the first week.",
  sources: [
    { paragraph: 1, source: "transcript", detail: "opening line" },
    { paragraph: 2, source: "interview", detail: "what went wrong" },
  ],
  visual: "Quote card with the hook.",
  scores: [
    { label: "Hook", score: 2 },
    { label: "Truth", score: 2 },
  ],
  total: 4,
  blanks: ["[ADD: the client name]"],
});

const legacyReply = JSON.stringify({
  draft: "We lost a client.",
  plain: "We lost a client.",
  short: "We lost a client.",
  sources: [{ paragraph: 1, source: "transcript", detail: "opening line" }],
});

describe("draft reply shape", () => {
  it("keeps the full new shape with every engagement field", () => {
    const parsed = parseDraftReply(fullReply);
    expect(parsed).not.toBeNull();
    expect(parsed?.idea).toContain("one owner beats a busy week");
    expect(parsed?.hooks).toHaveLength(3);
    expect(parsed?.hooks?.[0].picked).toBe(true);
    expect(parsed?.hooks?.[1].picked).toBe(false);
    expect(parsed?.visual).toBe("Quote card with the hook.");
    expect(parsed?.scores).toHaveLength(2);
    expect(parsed?.total).toBe(4);
    expect(parsed?.blanks).toEqual(["[ADD: the client name]"]);
    expect(parsed?.sources).toHaveLength(2);
  });

  it("still parses a legacy reply with no engagement fields", () => {
    const parsed = parseDraftReply(legacyReply);
    expect(parsed).not.toBeNull();
    expect(parsed?.draft).toBe("We lost a client.");
    expect(parsed?.idea).toBeUndefined();
    expect(parsed?.hooks).toBeUndefined();
    expect(parsed?.scores).toBeUndefined();
    expect(parsed?.blanks).toBeUndefined();
  });

  it("drops a malformed optional field instead of failing the reply", () => {
    const broken = JSON.stringify({
      draft: "We lost a client.",
      plain: "We lost a client.",
      short: "We lost a client.",
      sources: [
        { paragraph: 1, source: "transcript", detail: "opening line" },
      ],
      hooks: [{ width: "Broad", text: "We lost a client." }],
      total: "fourteen",
    });
    const parsed = parseDraftReply(broken);
    expect(parsed).not.toBeNull();
    expect(parsed?.draft).toBe("We lost a client.");
    expect(parsed?.hooks).toBeUndefined();
    expect(parsed?.total).toBeUndefined();
  });

  it("rejects a reply with no draft text", () => {
    const parsed = parseDraftReply(
      JSON.stringify({ draft: "  ", plain: "x", short: "x", sources: [] }),
    );
    expect(parsed).toBeNull();
  });

  it("rejects bad JSON and a non-array sources field", () => {
    expect(parseDraftReply("not json at all")).toBeNull();
    expect(
      parseDraftReply(
        JSON.stringify({
          draft: "We lost a client.",
          plain: "x",
          short: "x",
          sources: "transcript",
        }),
      ),
    ).toBeNull();
  });
});
