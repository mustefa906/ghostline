// Audio input validation shared by the recorder UI and the transcribe route.

export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
export const MAX_AUDIO_SECONDS = 180;

export const ACCEPTED_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "video/webm",
];

export const ACCEPTED_AUDIO_EXTENSIONS = ["mp3", "m4a", "wav", "webm"];

export type AudioProblem = {
  code: "too-large" | "bad-type" | "too-long";
  message: string;
};

export function validateAudioFile(file: {
  name: string;
  size: number;
  type: string;
}): AudioProblem | null {
  if (file.size > MAX_AUDIO_BYTES) {
    return {
      code: "too-large",
      message: `That file is over 25 MB. Please use a shorter clip or a smaller file.`,
    };
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const typeOk = ACCEPTED_AUDIO_TYPES.includes(file.type.toLowerCase());
  const extensionOk = ACCEPTED_AUDIO_EXTENSIONS.includes(extension);
  if (!typeOk && !extensionOk) {
    return {
      code: "bad-type",
      message: `Ghostline takes mp3, m4a, wav, or webm audio. That file type does not match.`,
    };
  }

  return null;
}

export function validateAudioDuration(seconds: number): AudioProblem | null {
  if (seconds > MAX_AUDIO_SECONDS) {
    return {
      code: "too-long",
      message: `Voice notes are capped at 3 minutes. That audio runs ${Math.round(
        seconds,
      )} seconds, so please record a shorter one.`,
    };
  }
  return null;
}

export function formatSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
