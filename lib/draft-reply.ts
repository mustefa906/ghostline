// Parsing for the draft engine reply. This module stays free of Next.js
// imports so the shape can be unit tested on its own. The required fields
// are draft, plain, short, and sources. The engagement fields are optional:
// a reply without them still parses, and a malformed optional field is
// dropped instead of failing the whole reply.

export type DraftHook = { width: string; text: string; picked: boolean };
export type DraftScore = { label: string; score: number };
export type DraftSource = { paragraph: number; source: string; detail: string };

export type VerifyCheck = {
  sentence: string;
  supported: boolean;
  evidence: string;
};
export type VerifyReply = { checks: VerifyCheck[] };
export type VerifyFlag = { sentence: string; evidence: string };

export type DraftReply = {
  draft: string;
  plain: string;
  short: string;
  sources: DraftSource[];
  idea?: string;
  hooks?: DraftHook[];
  visual?: string;
  scores?: DraftScore[];
  total?: number;
  blanks?: string[];
};

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return null;
    out.push(item);
  }
  return out;
}

function asHooks(value: unknown): DraftHook[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const out: DraftHook[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) return null;
    const entry = item as Record<string, unknown>;
    if (
      typeof entry.width !== "string" ||
      typeof entry.text !== "string" ||
      typeof entry.picked !== "boolean"
    ) {
      return null;
    }
    out.push({
      width: entry.width,
      text: entry.text,
      picked: entry.picked,
    });
  }
  return out;
}

function asScores(value: unknown): DraftScore[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const out: DraftScore[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) return null;
    const entry = item as Record<string, unknown>;
    if (
      typeof entry.label !== "string" ||
      typeof entry.score !== "number" ||
      !Number.isFinite(entry.score)
    ) {
      return null;
    }
    out.push({ label: entry.label, score: entry.score });
  }
  return out;
}

function asSources(value: unknown): DraftSource[] | null {
  if (!Array.isArray(value)) return null;
  const out: DraftSource[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) return null;
    const entry = item as Record<string, unknown>;
    if (
      typeof entry.paragraph !== "number" ||
      typeof entry.source !== "string" ||
      typeof entry.detail !== "string"
    ) {
      return null;
    }
    out.push({
      paragraph: entry.paragraph,
      source: entry.source,
      detail: entry.detail,
    });
  }
  return out;
}

export function parseDraftReply(raw: string): DraftReply | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
  const draft = asNonEmptyString(parsed.draft);
  const sources = asSources(parsed.sources);
  if (
    draft === null ||
    sources === null ||
    typeof parsed.plain !== "string" ||
    typeof parsed.short !== "string"
  ) {
    return null;
  }
  const reply: DraftReply = {
    draft,
    plain: parsed.plain as string,
    short: parsed.short as string,
    sources,
  };
  const idea = asNonEmptyString(parsed.idea);
  if (idea !== null) reply.idea = idea;
  const hooks = asHooks(parsed.hooks);
  if (hooks !== null) reply.hooks = hooks;
  const visual = asNonEmptyString(parsed.visual);
  if (visual !== null) reply.visual = visual;
  const scores = asScores(parsed.scores);
  if (scores !== null) reply.scores = scores;
  if (typeof parsed.total === "number" && Number.isFinite(parsed.total)) {
    reply.total = parsed.total;
  }
  const blanks = asStringArray(parsed.blanks);
  if (blanks !== null) reply.blanks = blanks;
  return reply;
}

// Parsing for the verification reply. The verifier checks the draft against
// the transcript and the answers only. A malformed reply means no flags,
// never a failed draft: the caller treats a null parse as an empty check
// list, so the draft stands exactly as it was generated.

function asChecks(value: unknown): VerifyCheck[] | null {
  if (!Array.isArray(value)) return null;
  const out: VerifyCheck[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) return null;
    const entry = item as Record<string, unknown>;
    if (
      typeof entry.sentence !== "string" ||
      typeof entry.supported !== "boolean" ||
      typeof entry.evidence !== "string"
    ) {
      return null;
    }
    out.push({
      sentence: entry.sentence,
      supported: entry.supported,
      evidence: entry.evidence,
    });
  }
  return out;
}

export function parseVerifyReply(raw: string): VerifyReply | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<
      string,
      unknown
    >;
    const checks = asChecks(parsed.checks);
    if (checks === null) return null;
    return { checks };
  } catch {
    return null;
  }
}

// The unsupported sentences, each with the note on what is missing or
// changed. An empty list means every checked sentence held up, or the
// verification never ran.
export function verifyFlags(reply: VerifyReply | null): VerifyFlag[] {
  if (reply === null) return [];
  return reply.checks
    .filter((check) => !check.supported)
    .map((check) => ({ sentence: check.sentence, evidence: check.evidence }));
}
