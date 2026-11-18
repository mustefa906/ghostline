"use client";

import { useEffect, useState } from "react";
import { DEMO_DRAFT, DEMO_INTERVIEW, DEMO_TRANSCRIPT } from "@/lib/demo-seed";
import Waveform from "@/components/Waveform";

const STAGE_LABELS = ["Voice note", "Interview", "Draft"];
const STAGE_HOLD_MS = [4500, 5000, 0];

const TRANSCRIPT_SNIPPET = DEMO_TRANSCRIPT.slice(0, 180);

// A looping sample run with the made-up demo founder: voice note, then
// one interview question and answer, then the draft typing itself out
// line by line. The stage chips are buttons, so anyone can jump to a step.
export default function DemoLoop() {
  const [reduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [stage, setStage] = useState(reduced ? 2 : 0);
  const [typed, setTyped] = useState(reduced ? DEMO_DRAFT.length : 0);

  useEffect(() => {
    if (reduced) return;
    if (stage === 2) {
      if (typed < DEMO_DRAFT.length) {
        const timer = setTimeout(
          () => setTyped((n) => Math.min(n + 8, DEMO_DRAFT.length)),
          50,
        );
        return () => clearTimeout(timer);
      }
      const timer = setTimeout(() => {
        setStage(0);
        setTyped(0);
      }, 3000);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(
      () => setStage((s) => (s + 1) % 3),
      STAGE_HOLD_MS[stage],
    );
    return () => clearTimeout(timer);
  }, [stage, typed, reduced]);

  function jumpTo(next: number) {
    setStage(next);
    setTyped(0);
  }

  const interview = DEMO_INTERVIEW[0];

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-800 bg-stone-900 text-stone-100 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-800 px-5 py-3">
        {STAGE_LABELS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => jumpTo(i)}
            aria-pressed={stage === i}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              stage === i
                ? "bg-brass text-white"
                : "bg-stone-800 text-stone-300 hover:bg-stone-700"
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
        <span className="ml-auto rounded-full bg-stone-800 px-2.5 py-1 text-xs font-medium text-stone-400">
          Sample run
        </span>
      </div>

      <div className="min-h-[280px] p-5">
        {stage === 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">
              Voice note - 0:42
            </p>
            <Waveform bars={32} className="mt-3" barClassName="bg-brass" />
            <p className="mt-4 text-sm leading-relaxed text-stone-300">
              &ldquo;{TRANSCRIPT_SNIPPET}&hellip;&rdquo;
            </p>
          </div>
        )}

        {stage === 1 && (
          <div className="space-y-3">
            <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-stone-800 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                Ghostline asks
              </p>
              <p className="mt-1 text-sm leading-relaxed">{interview.question}</p>
            </div>
            <div className="ml-auto max-w-[90%] rounded-2xl rounded-tr-sm bg-brass px-4 py-3 text-white">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-100">
                Maya answers
              </p>
              <p className="mt-1 text-sm leading-relaxed">{interview.answer}</p>
            </div>
            <p className="pt-1 text-xs text-stone-500">
              Two more follow-ups after this one. 3 questions max.
            </p>
          </div>
        )}

        {stage === 2 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">
              Draft, typed from her words
            </p>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-stone-100">
              {DEMO_DRAFT.slice(0, typed)}
              {typed < DEMO_DRAFT.length && (
                <span className="type-caret ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-brass" />
              )}
            </p>
          </div>
        )}
      </div>

      <p className="border-t border-stone-800 px-5 py-3 text-xs text-stone-500">
        A sample run with Maya Chen, a made-up founder. Nothing here is real.
      </p>
    </div>
  );
}
