import { describe, expect, it } from "vitest";
import {
  parseDraftReply,
  parseVerifyReply,
  verifyFlags,
} from "../lib/draft-reply";

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

describe("verify reply shape", () => {
  const verifyReply = JSON.stringify({
    checks: [
      {
        sentence: "We lost a client last month.",
        supported: true,
        evidence: "We lost a client last month.",
      },
      {
        sentence: "Then we lost another one.",
        supported: false,
        evidence: "adds a second loss the input never stated",
      },
      {
        sentence: "We were losing 1 in 4 clients in week one.",
        supported: false,
        evidence: "adds week one to a number the input never timed",
      },
    ],
  });

  it("keeps a valid shape with supported and unsupported sentences", () => {
    const parsed = parseVerifyReply(verifyReply);
    expect(parsed).not.toBeNull();
    expect(parsed?.checks).toHaveLength(3);
    expect(parsed?.checks[0].supported).toBe(true);
    expect(parsed?.checks[0].evidence).toBe(
      "We lost a client last month.",
    );
    expect(verifyFlags(parsed)).toHaveLength(2);
    expect(verifyFlags(parsed)[0].sentence).toBe(
      "Then we lost another one.",
    );
    expect(verifyFlags(parsed)[0].evidence).toBe(
      "adds a second loss the input never stated",
    );
    expect(verifyFlags(parsed)[1].sentence).toBe(
      "We were losing 1 in 4 clients in week one.",
    );
  });

  it("keeps an empty checks list, which means no flags", () => {
    const parsed = parseVerifyReply(JSON.stringify({ checks: [] }));
    expect(parsed).not.toBeNull();
    expect(parsed?.checks).toEqual([]);
    expect(verifyFlags(parsed)).toEqual([]);
  });

  it("yields no flags from malformed input, so the draft still stands", () => {
    expect(parseVerifyReply("not json at all")).toBeNull();
    expect(
      parseVerifyReply(JSON.stringify({ checks: "all clear" })),
    ).toBeNull();
    expect(
      parseVerifyReply(
        JSON.stringify({
          checks: [
            { sentence: "We lost a client.", supported: true },
          ],
        }),
      ),
    ).toBeNull();
    expect(
      parseVerifyReply(
        JSON.stringify({
          checks: [
            {
              sentence: "We lost a client.",
              supported: "yes",
              evidence: "transcript",
            },
          ],
        }),
      ),
    ).toBeNull();
    expect(verifyFlags(null)).toEqual([]);
  });
});
