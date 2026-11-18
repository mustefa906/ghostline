"use client";

import { DEMO_FINGERPRINT_POSTS } from "@/lib/demo-seed";

// Three past posts go in, one voice card comes out. The posts are
// Maya Chen demo data, shown as short excerpts.
export default function FingerprintVisual() {
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        {DEMO_FINGERPRINT_POSTS.map((post, i) => (
          <div
            key={i}
            className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">
              Past post {i + 1}
            </p>
            <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-stone-700">
              {post.split("\n\n")[0]}
            </p>
          </div>
        ))}
      </div>

      <div className="my-4 flex justify-center" aria-hidden="true">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brass text-lg font-semibold text-white">
          ↓
        </span>
      </div>

      <div className="mx-auto max-w-md rounded-2xl border border-stone-800 bg-ink p-5 text-stone-100 shadow-sm">
        <p className="font-display text-lg font-semibold">Your voice fingerprint</p>
        <p className="mt-1 text-sm text-stone-400">
          Learned from your own posts. Drafts match it, never copy it.
        </p>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4 border-b border-stone-800 pb-2">
            <dt className="text-stone-400">Cadence</dt>
            <dd className="font-medium">Short lines</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-stone-800 pb-2">
            <dt className="text-stone-400">Sentence length</dt>
            <dd className="font-medium">Short</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-stone-400">Words</dt>
            <dd className="font-medium">Plain and direct</dd>
          </div>
        </dl>
      </div>

      <p className="mt-4 text-center text-xs text-stone-500">
        Sample data from Maya Chen, a made-up demo founder.
      </p>
    </div>
  );
}
