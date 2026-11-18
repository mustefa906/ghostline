"use client";

// Proof from a real client, plus the line that sums up how Ghostline
// was built.
export default function ProofStrip() {
  return (
    <div className="rounded-2xl border border-stone-800 bg-ink px-6 py-10 text-center text-stone-100 shadow-sm sm:px-12">
      <p className="font-display text-2xl font-semibold leading-snug sm:text-3xl">
        &ldquo;together we tripled my reach in that period&rdquo;
      </p>
      <p className="mt-4 text-sm text-stone-400">
        Gabriel Beaudoin, founder, Neo Carbone
      </p>
      <p className="mx-auto mt-8 max-w-md border-t border-stone-800 pt-6 text-sm font-medium text-stone-300">
        Built by a ghostwriter who interviews first.
      </p>
    </div>
  );
}
