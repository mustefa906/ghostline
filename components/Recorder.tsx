"use client";

import { useEffect, useRef, useState } from "react";
import {
  formatSeconds,
  MAX_AUDIO_SECONDS,
  validateAudioDuration,
  validateAudioFile,
} from "@/lib/validation";
import Waveform from "@/components/Waveform";

export type RecorderResult =
  | { kind: "audio"; blob: Blob; seconds: number }
  | { kind: "text"; text: string };

type Props = {
  onSubmit: (result: RecorderResult) => void;
  busy?: boolean;
  submitLabel?: string;
};

export default function Recorder({
  onSubmit,
  busy = false,
  submitLabel = "Transcribe it",
}: Props) {
  const [mode, setMode] = useState<"record" | "upload" | "type">("record");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioSeconds, setAudioSeconds] = useState(0);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const secondsRef = useRef(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return url;
        });
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      setRecording(true);
      secondsRef.current = 0;
      setSeconds(0);
      timerRef.current = setInterval(() => {
        secondsRef.current += 1;
        setSeconds(secondsRef.current);
        if (secondsRef.current >= MAX_AUDIO_SECONDS) {
          stopRecording();
        }
      }, 1000);
    } catch {
      setError(
        "The microphone did not start. Check the browser permission, or upload a file or type your idea instead.",
      );
    }
  }

  function stopRecording() {
    stopTimer();
    setRecording(false);
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    setAudioSeconds(secondsRef.current);
  }

  function handleFile(file: File) {
    setError(null);
    const problem = validateAudioFile({
      name: file.name,
      size: file.size,
      type: file.type,
    });
    if (problem) {
      setError(problem.message);
      return;
    }
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.addEventListener("loadedmetadata", () => {
      const durationProblem = validateAudioDuration(audio.duration);
      if (durationProblem) {
        setError(durationProblem.message);
        URL.revokeObjectURL(url);
        return;
      }
      setAudioBlob(file);
      setAudioSeconds(Math.round(audio.duration));
      setAudioUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return url;
      });
    });
    audio.addEventListener("error", () => {
      setError("That audio file could not be read. Try another file.");
      URL.revokeObjectURL(url);
    });
  }

  function submit() {
    setError(null);
    if (mode === "type") {
      if (!text.trim()) {
        setError("Type your idea first.");
        return;
      }
      onSubmit({ kind: "text", text: text.trim() });
      return;
    }
    if (!audioBlob) {
      setError("Record a voice note or upload a file first.");
      return;
    }
    onSubmit({ kind: "audio", blob: audioBlob, seconds: audioSeconds });
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex gap-2">
        {(
          [
            ["record", "Record"],
            ["upload", "Upload"],
            ["type", "Type it"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              mode === key
                ? "bg-ink text-white"
                : "bg-stone-100 text-stone-700 hover:bg-stone-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "record" && (
        <div>
          <p className="mb-3 text-sm text-stone-600">
            Talk about one idea. Up to 3 minutes.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            {!recording ? (
              <button
                type="button"
                onClick={startRecording}
                disabled={busy}
                className="min-h-[52px] w-full rounded-full bg-brass px-7 py-3.5 text-base font-semibold text-white disabled:opacity-50 sm:w-auto"
              >
                Start recording
              </button>
            ) : (
              <button
                type="button"
                onClick={stopRecording}
                className="min-h-[52px] w-full rounded-full bg-red-700 px-7 py-3.5 text-base font-semibold text-white sm:w-auto"
              >
                Stop
              </button>
            )}
            <span className="font-mono text-lg tabular-nums">
              {formatSeconds(seconds)}
              <span className="text-stone-400"> / 3:00</span>
            </span>
            {recording && (
              <span className="flex items-center gap-1.5 text-sm text-red-700">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" />
                Recording
              </span>
            )}
          </div>
          {recording && (
            <div className="mt-4 rounded-lg bg-red-50 px-4 py-1">
              <Waveform bars={36} barClassName="bg-red-600" />
            </div>
          )}
          {audioUrl && !recording && (
            <div className="mt-4">
              <p className="mb-2 text-sm text-stone-600">
                Your recording ({formatSeconds(audioSeconds)}). Play it back
                before you continue.
              </p>
              <audio controls src={audioUrl} className="w-full" />
            </div>
          )}
        </div>
      )}

      {mode === "upload" && (
        <div>
          <p className="mb-3 text-sm text-stone-600">
            Upload an existing recording. mp3, m4a, wav, or webm, up to 25 MB
            and 3 minutes.
          </p>
          <input
            type="file"
            accept=".mp3,.m4a,.wav,.webm,audio/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
            className="block w-full text-sm text-stone-700 file:mr-3 file:rounded-full file:border-0 file:bg-stone-100 file:px-4 file:py-2 file:text-sm file:font-medium hover:file:bg-stone-200"
          />
          {audioUrl && (
            <div className="mt-4">
              <p className="mb-2 text-sm text-stone-600">
                Ready ({formatSeconds(audioSeconds)}).
              </p>
              <audio controls src={audioUrl} className="w-full" />
            </div>
          )}
        </div>
      )}

      {mode === "type" && (
        <div>
          <p className="mb-3 text-sm text-stone-600">
            Type the idea the way you would say it. The interview and the
            draft start from these words.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="Talk it out in writing. What happened, what changed, what did you learn?"
            className="w-full rounded-lg border border-stone-300 p-3 text-sm outline-none focus:border-brass"
          />
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="mt-5 rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Working..." : submitLabel}
      </button>
    </div>
  );
}
