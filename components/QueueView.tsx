"use client";

import { useEffect, useRef, useState } from "react";

export type QueueDraft = {
  id: string;
  body: string;
  editedBody: string | null;
  sourceNote: string;
  version: string;
  status: string;
  scheduledFor: string | null;
  createdAt: string;
};

type Props = {
  founderId: string;
  refreshKey: number;
};

function displayBody(draft: QueueDraft): string {
  return draft.editedBody ?? draft.body;
}

function isDue(draft: QueueDraft): boolean {
  if (!draft.scheduledFor) return false;
  return new Date(draft.scheduledFor).getTime() <= Date.now();
}

export default function QueueView({ founderId, refreshKey }: Props) {
  const [drafts, setDrafts] = useState<QueueDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const firstLoadRef = useRef(true);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (firstLoadRef.current) setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/posts?founderId=${encodeURIComponent(founderId)}`,
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "The queue could not load.");
        }
        if (!cancelled) setDrafts(data.posts ?? []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "The queue could not load.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          firstLoadRef.current = false;
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [founderId, refreshKey, now]);

  async function markPosted(id: string) {
    try {
      const res = await fetch("/api/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "posted" }),
      });
      if (!res.ok) return;
      setDrafts((list) =>
        list.map((d) => (d.id === id ? { ...d, status: "posted" } : d)),
      );
    } catch {
      // Leave the row as it is when the update fails.
    }
  }

  async function copyDraft(draft: QueueDraft) {
    try {
      await navigator.clipboard.writeText(displayBody(draft));
      setCopiedId(draft.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError("Copy did not work in this browser. Select the text by hand.");
    }
  }

  async function removeDraft(id: string) {
    try {
      const res = await fetch(`/api/posts?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) return;
      setDrafts((list) => list.filter((d) => d.id !== id));
    } catch {
      // Leave the row as it is when the delete fails.
    }
  }

  const upcoming = drafts.filter((d) => d.status !== "posted");
  const posted = drafts.filter((d) => d.status === "posted");

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Your queue</h2>
      <p className="mt-1 text-sm text-stone-600">
        Ghostline never posts for you. When a post is due, copy it and post it
        yourself, then mark it posted.
      </p>

      {loading && <p className="mt-4 text-sm text-stone-500">Loading...</p>}
      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {!loading && upcoming.length === 0 && posted.length === 0 && (
        <p className="mt-4 rounded-lg bg-stone-50 px-4 py-6 text-center text-sm text-stone-500">
          Your queue is empty. Finish a draft and schedule it, and it will
          show up here.
        </p>
      )}

      {upcoming.length > 0 && (
        <div className="mt-4 space-y-4">
          {upcoming.map((draft) => {
            const due = isDue(draft);
            return (
              <div
                key={draft.id}
                className={`rounded-lg border p-4 ${
                  due
                    ? "border-brass bg-amber-50"
                    : "border-stone-200 bg-stone-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      due
                        ? "bg-brass text-white"
                        : "bg-stone-200 text-stone-700"
                    }`}
                  >
                    {due
                      ? "Ready to copy"
                      : draft.scheduledFor
                        ? `Scheduled for ${new Date(
                            draft.scheduledFor,
                          ).toLocaleString()}`
                        : "Draft"}
                  </span>
                  <span className="text-xs text-stone-400">
                    {draft.version}
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-stone-800">
                  {displayBody(draft)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void copyDraft(draft)}
                    className="rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-white"
                  >
                    {copiedId === draft.id ? "Copied" : "Copy to clipboard"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void markPosted(draft.id)}
                    className="rounded-full bg-stone-200 px-4 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-300"
                  >
                    Mark posted
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeDraft(draft.id)}
                    className="rounded-full px-4 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {posted.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-stone-500">Posted</h3>
          <ul className="mt-2 space-y-2">
            {posted.map((draft) => (
              <li
                key={draft.id}
                className="rounded-lg bg-stone-50 px-4 py-3 text-sm text-stone-600"
              >
                <span className="line-clamp-2 whitespace-pre-line">
                  {displayBody(draft)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
