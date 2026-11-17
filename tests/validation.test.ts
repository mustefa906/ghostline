import { describe, expect, it } from "vitest";
import {
  MAX_AUDIO_BYTES,
  validateAudioDuration,
  validateAudioFile,
} from "../lib/validation";

describe("audio validation", () => {
  it("accepts a small mp3", () => {
    expect(
      validateAudioFile({ name: "note.mp3", size: 1024, type: "audio/mpeg" }),
    ).toBeNull();
  });

  it("accepts a webm recording by type", () => {
    expect(
      validateAudioFile({ name: "blob", size: 1024, type: "audio/webm" }),
    ).toBeNull();
  });

  it("accepts a file by extension when the type is generic", () => {
    expect(
      validateAudioFile({
        name: "note.m4a",
        size: 1024,
        type: "application/octet-stream",
      }),
    ).toBeNull();
  });

  it("rejects a file over 25 MB", () => {
    const problem = validateAudioFile({
      name: "big.mp3",
      size: MAX_AUDIO_BYTES + 1,
      type: "audio/mpeg",
    });
    expect(problem?.code).toBe("too-large");
  });

  it("rejects an unsupported type", () => {
    const problem = validateAudioFile({
      name: "notes.txt",
      size: 1024,
      type: "text/plain",
    });
    expect(problem?.code).toBe("bad-type");
  });

  it("enforces the 3-minute cap", () => {
    expect(validateAudioDuration(180)).toBeNull();
    expect(validateAudioDuration(181)?.code).toBe("too-long");
  });
});
