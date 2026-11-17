import { describe, expect, it } from "vitest";
import { checkCopyRules, passesCopyRules, repairDashes } from "../lib/copy-rules";

// Built from code points so the test does not depend on how an editor
// renders dash characters.
const EM_DASH = String.fromCharCode(0x2014);
const EN_DASH = String.fromCharCode(0x2013);

describe("copy rules", () => {
  it("flags an em dash", () => {
    const violations = checkCopyRules(
      `Talk for two minutes ${EM_DASH} then stop.`,
    );
    expect(violations.some((v) => v.rule === "em-dash")).toBe(true);
  });

  it("flags an en dash", () => {
    const violations = checkCopyRules(`Monday ${EN_DASH} Friday, 9 to 5.`);
    expect(violations.some((v) => v.rule === "em-dash")).toBe(true);
  });

  it("flags an opposite-definition construction", () => {
    const violations = checkCopyRules(
      "We write from interviews, not briefs.",
    );
    expect(violations.some((v) => v.rule === "opposite-definition")).toBe(true);
  });

  it("passes plain uses of not", () => {
    expect(passesCopyRules("I called them, not expecting an answer.")).toBe(true);
    expect(passesCopyRules("Not only fast, but careful work.")).toBe(true);
    expect(passesCopyRules("I am not sure yet.")).toBe(true);
  });

  it("passes clean copy", () => {
    expect(
      passesCopyRules(
        "Talk for two minutes. Answer a few questions. Get a draft you can stand behind.",
      ),
    ).toBe(true);
  });

  it("repairs dashes to simple hyphens", () => {
    expect(repairDashes(`one ${EM_DASH} two ${EN_DASH} three`)).toBe(
      "one - two - three",
    );
  });
});
