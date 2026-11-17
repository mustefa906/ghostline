import Anthropic from "@anthropic-ai/sdk";

export const CLAUDE_MODEL =
  process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

export type MissingKeyError = {
  code: "missing-key";
  message: string;
};

export function getAnthropicClient():
  | { client: Anthropic }
  | MissingKeyError {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return {
      code: "missing-key",
      message:
        "The interview and drafting need an Anthropic key. Set ANTHROPIC_API_KEY in your environment and try again.",
    };
  }
  return { client: new Anthropic({ apiKey: key }) };
}

export function isMissingKey(
  value: unknown,
): value is MissingKeyError {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as MissingKeyError).code === "missing-key"
  );
}
