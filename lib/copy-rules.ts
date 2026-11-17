// House copy rules, enforced on every draft the app generates and on the
// app's own user-facing strings. Two rules:
// 1. Simple hyphens only. Never an em dash.
// 2. Say the thing itself, plainly. No defining something by its opposite.

export type CopyViolation = {
  rule: "em-dash" | "opposite-definition";
  excerpt: string;
};

const EM_DASH = /\u2014|\u2013/g;

// Matches the opposite-defining shape: a phrase, a comma, "not", a phrase.
// It skips the plain uses that are not definitions: "not only", "not sure",
// and "not" followed by a participle such as "not expecting".
const OPPOSITE_DEFINITION =
  /[A-Za-z][A-Za-z' ]{2,},\s+not\s+(?!only\b)(?!sure\b)(?![a-z]+ing\b)[a-z][a-z' ]{1,}/g;

export function checkCopyRules(text: string): CopyViolation[] {
  const violations: CopyViolation[] = [];

  for (const match of text.matchAll(EM_DASH)) {
    const start = Math.max(0, (match.index ?? 0) - 24);
    violations.push({
      rule: "em-dash",
      excerpt: text.slice(start, (match.index ?? 0) + 25).replace(/\n/g, " "),
    });
  }

  for (const match of text.matchAll(OPPOSITE_DEFINITION)) {
    violations.push({
      rule: "opposite-definition",
      excerpt: match[0].trim(),
    });
  }

  return violations;
}

export function passesCopyRules(text: string): boolean {
  return checkCopyRules(text).length === 0;
}

// Mechanical repair for the one rule that can be fixed safely: swap every
// em dash or en dash for a simple hyphen. The opposite-definition rule
// cannot be repaired by machine, so it is caught by checkCopyRules instead.
export function repairDashes(text: string): string {
  return text.replace(/[\u2014\u2013]/g, "-");
}
