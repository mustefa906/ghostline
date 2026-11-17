"use client";

import { useState } from "react";
import Recorder, { type RecorderResult } from "./Recorder";

export type ChatTurn = {
  role: "agent" | "founder";
  body: string;
  kind?: string;
};

type Props = {
  transcript: string;
  sessionId: string | null;
  onFinish: (turns: ChatTurn[], summary: string) => void;
};

export default function InterviewChat({
  transcript,
  sessionId,
  onFinish,
}: Props) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [started, setStarted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState("");
  const [answeringByVoice, setAnsweringByVoice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const mainAsked = turns.filter(
    (t) => t.role === "agent" && t.kind !== "clarify",
  ).length;
  const waitingForAnswer =
    started && !done && turns.length > 0 && turns[turns.length - 1].role === "agent";

  async function callInterview(
    nextTurns: ChatTurn[],
    mode: "question" | "summary",
  ) {
    const res = await fetch("/api/interview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript,
        turns: nextTurns,
        mode,
        sessionId,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error ?? "The interview hit a snag.");
    }
    return data;
  }

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const data = await callInterview([], "question");
      if (data.kind === "done") {
        setDone(true);
        await finish([]);
      } else {
        setTurns([{ role: "agent", body: data.text, kind: data.kind }]);
        setStarted(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "The interview hit a snag.");
    } finally {
      setBusy(false);
    }
  }

  async function finish(finalTurns: ChatTurn[]) {
    setBusy(true);
    setError(null);
    try {
      const data = await callInterview(finalTurns, "summary");
      setSummary(data.summary ?? "");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The summary hit a snag.");
    } finally {
      setBusy(false);
    }
  }

  async function sendAnswer(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !waitingForAnswer) return;
    setBusy(true);
    setError(null);
    const nextTurns: ChatTurn[] = [
      ...turns,
      { role: "founder", body: trimmed },
    ];
    setTurns(nextTurns);
    setAnswer("");
    try {
      const data = await callInterview(nextTurns, "question");
      if (data.kind === "done") {
        setDone(true);
        await finish(nextTurns);
      } else {
        setTurns([
          ...nextTurns,
          { role: "agent", body: data.text, kind: data.kind },
        ]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "The interview hit a snag.");
    } finally {
      setBusy(false);
    }
  }

  async function skipQuestion() {
    if (!waitingForAnswer) return;
    setBusy(true);
    setError(null);
    const nextTurns: ChatTurn[] = [
      ...turns,
      { role: "founder", body: "[skipped]", kind: "skipped" },
    ];
    setTurns(nextTurns);
    try {
      const data = await callInterview(nextTurns, "question");
      if (data.kind === "done") {
        setDone(true);
        await finish(nextTurns);
      } else {
        setTurns([
          ...nextTurns,
          { role: "agent", body: data.text, kind: data.kind },
        ]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "The interview hit a snag.");
    } finally {
      setBusy(false);
    }
  }

  async function handleVoiceAnswer(result: RecorderResult) {
    if (result.kind === "text") {
      await sendAnswer(result.text);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append(
        "audio",
        result.blob,
        `answer-${Date.now()}.webm`,
      );
      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Transcription failed.");
      }
      setAnsweringByVoice(false);
      await sendAnswer(data.transcript);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transcription failed.");
    } finally {
      setBusy(false);
    }
  }

  function endEarly() {
    void finish(turns);
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">The interview</h2>
      <p className="mt-1 text-sm text-stone-600">
        Up to 3 questions, one at a time. A vague answer gets one clarifying
        question. Skipped questions stay skipped.
      </p>

      {!started && !done && (
        <button
          type="button"
          onClick={start}
          disabled={busy}
          className="mt-4 rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Working..." : "Start the interview"}
        </button>
      )}

      {turns.length > 0 && (
        <div className="mt-4 space-y-3">
          {turns.map((turn, i) =>
            turn.body === "[skipped]" ? (
              <p key={i} className="text-sm italic text-stone-400">
                Question skipped.
              </p>
            ) : (
              <div
                key={i}
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  turn.role === "agent"
                    ? "bg-stone-100 text-stone-800"
                    : "ml-auto bg-ink text-white"
                }`}
              >
                {turn.body}
              </div>
            ),
          )}
        </div>
      )}

      {waitingForAnswer && !done && (
        <div className="mt-4">
          {!answeringByVoice ? (
            <div>
              <div className="flex gap-2">
                <input
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void sendAnswer(answer);
                  }}
                  placeholder="Type your answer..."
                  disabled={busy}
                  className="flex-1 rounded-full border border-stone-300 px-4 py-2 text-sm outline-none focus:border-brass disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => void sendAnswer(answer)}
                  disabled={busy || !answer.trim()}
                  className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Send
                </button>
              </div>
              <div className="mt-2 flex gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => setAnsweringByVoice(true)}
                  disabled={busy}
                  className="text-brass underline underline-offset-2 disabled:opacity-50"
                >
                  Answer by voice note
                </button>
                <button
                  type="button"
                  onClick={() => void skipQuestion()}
                  disabled={busy}
                  className="text-stone-500 underline underline-offset-2 disabled:opacity-50"
                >
                  Skip this question
                </button>
                <button
                  type="button"
                  onClick={endEarly}
                  disabled={busy}
                  className="text-stone-500 underline underline-offset-2 disabled:opacity-50"
                >
                  End the interview
                </button>
              </div>
            </div>
          ) : (
            <div>
              <Recorder
                onSubmit={(r) => void handleVoiceAnswer(r)}
                busy={busy}
                submitLabel="Transcribe my answer"
              />
              <button
                type="button"
                onClick={() => setAnsweringByVoice(false)}
                className="mt-2 text-sm text-stone-500 underline underline-offset-2"
              >
                Back to typing
              </button>
            </div>
          )}
        </div>
      )}

      {mainAsked > 0 && !done && (
        <p className="mt-3 text-xs text-stone-400">
          Question {Math.min(mainAsked, 3)} of 3 asked.
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {done && summary && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold">What you actually said</h3>
          <div className="mt-2 whitespace-pre-line rounded-lg bg-stone-50 p-4 text-sm leading-relaxed text-stone-700">
            {summary}
          </div>
          <button
            type="button"
            onClick={() => onFinish(turns, summary)}
            className="mt-4 rounded-full bg-brass px-6 py-2.5 text-sm font-semibold text-white"
          >
            Generate the draft
          </button>
        </div>
      )}
    </div>
  );
}
