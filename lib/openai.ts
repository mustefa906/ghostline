import OpenAI from "openai";

export function getOpenAIClient():
  | { client: OpenAI }
  | { code: "missing-key"; message: string } {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return {
      code: "missing-key",
      message:
        "Transcription needs an OpenAI key. Set OPENAI_API_KEY in your environment and try again.",
    };
  }
  return { client: new OpenAI({ apiKey: key }) };
}

export async function transcribeAudio(
  client: OpenAI,
  file: File,
): Promise<string> {
  const result = await client.audio.transcriptions.create({
    file,
    model: "whisper-1",
  });
  return result.text.trim();
}
