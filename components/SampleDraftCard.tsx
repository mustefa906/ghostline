"use client";

import { DEMO_DRAFT, DEMO_SOURCE_NOTE } from "@/lib/demo-seed";

// The finished draft for one paragraph group comes from the voice note,
// the rest come from interview answers. The legend marks each group so
// the source of every paragraph stays visible.
const SOURCE_FOR_PARAGRAPH: ("voice" | "interview")[] = [
  "voice",
  "voice",
  "voice",
  "interview",
  "interview",
  "interview",
  "interview",
  "interview",
  "interview",
  "interview",
  "interview",
];

// A sample finished LinkedIn post, with a visible note on where each
// line came from. Sample data from Maya Chen, a made-up demo founder.
export default function SampleDraftCard() {
  const paragraphs = DEMO_DRAFT.split("\n\n");

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-5 py-3">
        <p className="text-sm font-semibold">Sample draft</p>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
          Maya Chen - demo founder
        </span>
      </div>

      <div className="space-y-4 px-5 py-5">
        {paragraphs.map((paragraph, i) => (
          <p
            key={i}
            className={`border-l-2 pl-3 text-sm leading-relaxed text-stone-800 ${
              SOURCE_FOR_PARAGRAPH[i] === "voice"
                ? "border-brass"
                : "border-stone-300"
            }`}
          >
            {paragraph}
          </p>
        ))}
      </div>

      <div className="mx-5 mb-5 rounded-lg bg-stone-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
          Where each line came from
        </p>
        <p className="mt-1 text-sm leading-relaxed text-stone-600">
          {DEMO_SOURCE_NOTE}
        </p>
        <p className="mt-3 flex flex-wrap gap-4 text-xs text-stone-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-brass" />
            Voice note
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-stone-300" />
            Interview
          </span>
        </p>
      </div>

      <p className="border-t border-stone-100 px-5 py-3 text-xs text-stone-500">
        Maya Chen is a made-up founder. This draft comes from demo mode.
      </p>
    </div>
  );
}
