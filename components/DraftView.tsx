"use client";

import { useState } from "react";

export type DraftData = {
  draft: string;
  plain: string;
  short: string;
  sources: { paragraph: number; source: string; detail: string }[];
  sourceNote: string;
};

type Props = {
  data: DraftData;
  sessionId: string | null;
  founderId: string;
  onSaved: (draftId: string) => void;
};

export default function DraftView({
  data,
  sessionId,
  founderId,
  onSaved,
}: Props) {
  const [version, setVersion] = useState<"original" | "plain" | "short">(
    "original",
  );
  const [edited, setEdited] = useState(data.draft);
  const [editedTouched, setEditedTouched] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const currentText =
    version === "original"
      ? data.draft
      : version === "plain"
        ? data.plain
        : data.short;

  function switchVersion(v: "original" | "plain" | "short") {
    // Switching versions only replaces the text when the founder has not
    // edited anything yet. Founder edits always win.
    setVersion(v);
    if (!editedTouched) {
      setEdited(v === "original" ? data.draft : v === "plain" ? data.plain : data.short);
    }
  }

  async function saveToQueue() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          founderId,
          sessionId,
          body: currentText,
          sourceNote: data.sourceNote,
          version,
          scheduledFor: scheduledFor || null,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error ?? "Saving failed.");
      }
      // The edited text is the version of record when the founder changed it.
      if (editedTouched && edited.trim() && edited.trim() !== currentText) {
        const patch = await fetch("/api/posts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: payload.draft.id,
            editedBody: edited.trim(),
            status: scheduledFor ? "queued" : "draft",
          }),
        });
        const patched = await patch.json();
        if (!patch.ok) {
          throw new Error(patched.error ?? "Saving the edit failed.");
        }
        setSavedId(patched.draft.id);
        onSaved(patched.draft.id);
        return;
      }
      if (scheduledFor) {
        const patch = await fetch("/api/posts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: payload.draft.id,
            status: "queued",
          }),
        });
        const patched = await patch.json();
        if (!patch.ok) {
          throw new Error(patched.error ?? "Scheduling failed.");
        }
        setSavedId(patched.draft.id);
        onSaved(patched.draft.id);
        return;
      }
      setSavedId(payload.draft.id);
      onSaved(payload.draft.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saving failed.");
    } finally {
      setBusy(false);
    }
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(edited);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy did not work in this browser. Select the text by hand.");
    }
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Your draft</h2>
      <p className="mt-1 text-sm text-stone-600">
        Built only from your voice note, your interview answers, and your past
        posts. Edit any line. Your words win.
      </p>

      <div className="mt-4 flex gap-2">
        {(
          [
            ["original", "Draft"],
            ["plain", "Plainer"],
            ["short", "Shorter"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => switchVersion(key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              version === key
                ? "bg-ink text-white"
                : "bg-stone-100 text-stone-700 hover:bg-stone-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <textarea
        value={edited}
        onChange={(e) => {
          setEdited(e.target.value);
          setEditedTouched(true);
        }}
        rows={14}
        className="mt-4 w-full whitespace-pre-line rounded-lg border border-stone-300 p-4 text-sm leading-relaxed outline-none focus:border-brass"
      />
      {editedTouched && (
        <p className="mt-1 text-xs text-stone-500">
          Edited by you. This version is the one that gets saved.
        </p>
      )}

      <div className="mt-4 rounded-lg bg-stone-50 p-4">
        <h3 className="text-sm font-semibold">Where each line came from</h3>
        <p className="mt-1 text-sm leading-relaxed text-stone-600">
          {data.sourceNote}
        </p>
      </div>

      <div className="mt-4">
        <label className="text-sm font-medium" htmlFor="schedule">
          Schedule it (optional)
        </label>
        <input
          id="schedule"
          type="datetime-local"
          value={scheduledFor}
          onChange={(e) => setScheduledFor(e.target.value)}
          className="mt-1 block rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brass"
        />
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void saveToQueue()}
          disabled={busy}
          className="rounded-full bg-brass px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy
            ? "Saving..."
            : scheduledFor
              ? "Save to queue"
              : "Save draft"}
        </button>
        <button
          type="button"
          onClick={() => void copyText()}
          className="rounded-full bg-stone-100 px-6 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-200"
        >
          {copied ? "Copied" : "Copy to clipboard"}
        </button>
      </div>

      {savedId && (
        <p className="mt-3 text-sm text-green-800">
          Saved. Find it in your queue below.
        </p>
      )}
    </div>
  );
}
