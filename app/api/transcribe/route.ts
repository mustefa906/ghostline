import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient, transcribeAudio } from "@/lib/openai";
import { validateAudioFile } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "That request did not include an audio file." },
      { status: 400 },
    );
  }

  const file = form.get("audio");
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Attach an audio file first, or type your idea instead." },
      { status: 400 },
    );
  }

  const problem = validateAudioFile({
    name: file.name || "voice-note.webm",
    size: file.size,
    type: file.type,
  });
  if (problem) {
    return NextResponse.json({ error: problem.message }, { status: 400 });
  }

  const openai = getOpenAIClient();
  if ("code" in openai) {
    return NextResponse.json({ error: openai.message }, { status: 503 });
  }

  try {
    const transcript = await transcribeAudio(openai.client, file);
    if (!transcript) {
      return NextResponse.json(
        {
          error:
            "The transcription came back empty. Try recording again, or type your idea instead.",
        },
        { status: 502 },
      );
    }
    return NextResponse.json({ transcript });
  } catch {
    return NextResponse.json(
      {
        error:
          "Transcription failed. Check your connection and try again, or type your idea instead.",
      },
      { status: 502 },
    );
  }
}
