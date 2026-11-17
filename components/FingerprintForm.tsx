"use client";

import { useState } from "react";

type Props = {
  founderId: string;
  initialPosts: string[];
  onSaved: (posts: string[]) => void;
};

export default function FingerprintForm({
  founderId,
  initialPosts,
  onSaved,
}: Props) {
  const [posts, setPosts] = useState<string[]>(
    initialPosts.length > 0 ? initialPosts : [""],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function setPost(index: number, value: string) {
    setPosts((list) => list.map((p, i) => (i === index ? value : p)));
    setSaved(false);
  }

  function addPost() {
    if (posts.length >= 5) return;
    setPosts((list) => [...list, ""]);
  }

  function removePost(index: number) {
    setPosts((list) => list.filter((_, i) => i !== index));
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    setError(null);
    setWarning(null);
    try {
      const res = await fetch("/api/fingerprint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ founderId, posts }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Saving failed.");
      }
      setWarning(data.warning ?? null);
      setSaved(true);
      onSaved(data.posts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saving failed.");
    } finally {
      setBusy(false);
    }
  }

  const filled = posts.filter((p) => p.trim().length > 0).length;

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Your voice fingerprint</h2>
      <p className="mt-1 text-sm text-stone-600">
        Paste 3 to 5 of your past LinkedIn posts. Ghostline learns your
        cadence, your sentence length, and the words you use, so drafts sound
        like you. It never copies whole sentences from them.
      </p>

      {filled < 3 && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {filled === 0
            ? "No posts added yet. The voice match will be weaker without them."
            : `Only ${filled} post${filled === 1 ? "" : "s"} added. Add ${
                3 - filled
              } more for a stronger voice match.`}
        </p>
      )}

      <div className="mt-4 space-y-3">
        {posts.map((post, i) => (
          <div key={i}>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-medium">
                Past post {i + 1}
              </label>
              {posts.length > 1 && (
                <button
                  type="button"
                  onClick={() => removePost(i)}
                  className="text-xs text-red-700 underline underline-offset-2"
                >
                  Remove
                </button>
              )}
            </div>
            <textarea
              value={post}
              onChange={(e) => setPost(i, e.target.value)}
              rows={4}
              placeholder="Paste one of your past LinkedIn posts here."
              className="w-full rounded-lg border border-stone-300 p-3 text-sm leading-relaxed outline-none focus:border-brass"
            />
          </div>
        ))}
      </div>

      {posts.length < 5 && (
        <button
          type="button"
          onClick={addPost}
          className="mt-3 rounded-full bg-stone-100 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-200"
        >
          Add another post
        </button>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {warning && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {warning}
        </p>
      )}
      {saved && !warning && (
        <p className="mt-4 text-sm text-green-800">
          Voice fingerprint saved.
        </p>
      )}

      <button
        type="button"
        onClick={() => void save()}
        disabled={busy}
        className="mt-4 rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Saving..." : "Save fingerprint"}
      </button>
    </div>
  );
}
