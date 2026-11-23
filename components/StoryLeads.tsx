"use client";

import { useCallback, useEffect, useState } from "react";
import type { DismissReason, StoryLead } from "@/lib/store";

type Props = {
  founderId: string;
  demo: boolean;
  onPickLead: (lead: StoryLead) => void;
};

const DISMISS_REASONS: { value: DismissReason; label: string }[] = [
  { value: "not a story", label: "Not a story" },
  { value: "too sensitive", label: "Too sensitive" },
  { value: "already posted", label: "Already posted" },
];

export default function StoryLeads({ founderId, demo, onPickLead }: Props) {
  const [leads, setLeads] = useState<StoryLead[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  const loadLeads = useCallback(async () => {
    const res = await fetch(
      `/api/leads?founderId=${encodeURIComponent(founderId)}`,
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not load the leads.");
    return (data.leads ?? []) as StoryLead[];
  }, [founderId]);

  const runHarvest = useCallback(
    async (options: { refresh?: boolean; note?: string } = {}) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/leads/harvest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            founderId,
            demo,
            refresh: options.refresh ?? false,
            noteText: options.note ?? "",
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "The harvest hit a snag.");
        setLeads((data.leads ?? []) as StoryLead[]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "The harvest hit a snag.");
      } finally {
        setBusy(false);
      }
    },
    [founderId, demo],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/connections?founderId=${encodeURIComponent(founderId)}`)
      .then((res) => (res.ok ? res.json() : { connections: [] }))
      .then((data) => {
        if (!cancelled) {
          setConnected(((data.connections ?? []) as unknown[]).length > 0);
        }
      })
      .catch(() => undefined);
    loadLeads()
      .then((stored) => {
        if (cancelled) return;
        const fresh = stored.filter((l) => l.status === "new");
        if (fresh.length > 0) {
          setLeads(fresh);
          setLoading(false);
        } else {
          void runHarvest().finally(() => {
            if (!cancelled) setLoading(false);
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load the leads.");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [founderId, loadLeads, runHarvest]);

  async function dismiss(lead: StoryLead, reason: DismissReason) {
    setBusy(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "dismissed", dismissReason: reason }),
      });
      if (!res.ok) throw new Error("Could not dismiss that lead.");
      setLeads((current) => current.filter((l) => l.id !== lead.id));
      setDismissingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not dismiss that lead.");
    } finally {
      setBusy(false);
    }
  }

  async function pick(lead: StoryLead) {
    // The lead is marked used when the session is created, in page.tsx.
    // Picking it here only starts the post.
    onPickLead(lead);
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">This week</h2>
          <p className="mt-1 text-sm text-stone-600">
            Stories from your week. Pick one and talk about it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void runHarvest({ refresh: true })}
          disabled={busy || loading}
          className="shrink-0 rounded-full bg-stone-100 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-200 disabled:opacity-50"
        >
          {busy ? "Working..." : "Refresh leads"}
        </button>
      </div>

      {loading && (
        <p className="mt-4 text-sm text-stone-500">
          Finding this week&rsquo;s stories...
        </p>
      )}

      {!loading && leads.length === 0 && (
        <p className="mt-4 text-sm text-stone-600">
          Nothing post-worthy this week yet.
        </p>
      )}

      {!loading && leads.length > 0 && (
        <ul className="mt-4 space-y-3">
          {leads.map((lead) => (
            <li
              key={lead.id}
              className="rounded-lg border border-stone-200 p-4"
            >
              <p className="font-display text-base font-semibold">
                {lead.title}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-stone-600">
                {lead.whatHappened}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-stone-600">
                {lead.angle}
              </p>
              <p className="mt-2 text-xs text-stone-400">{lead.sourceLabel}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void pick(lead)}
                  disabled={busy}
                  className="rounded-full bg-brass px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Talk about this
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDismissingId(
                      dismissingId === lead.id ? null : lead.id,
                    )
                  }
                  disabled={busy}
                  className="rounded-full bg-stone-100 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-200 disabled:opacity-50"
                >
                  Dismiss
                </button>
              </div>
              {dismissingId === lead.id && (
                <div className="mt-3">
                  <p className="text-sm text-stone-600">Why not this one?</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {DISMISS_REASONS.map((reason) => (
                      <button
                        key={reason.value}
                        type="button"
                        onClick={() => void dismiss(lead, reason.value)}
                        disabled={busy}
                        className="rounded-full border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:border-stone-400 disabled:opacity-50"
                      >
                        {reason.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {!loading && !connected && !demo && (
        <div className="mt-5 border-t border-stone-200 pt-4">
          <label
            className="block text-sm font-medium"
            htmlFor="harvest-note"
          >
            What happened this week?
          </label>
          <textarea
            id="harvest-note"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={3}
            placeholder="A few lines about your week. A deal that closed, a call that ran long, a hire."
            className="mt-2 w-full rounded-lg border border-stone-300 p-3 text-sm leading-relaxed outline-none focus:border-brass"
          />
          <button
            type="button"
            onClick={() => void runHarvest({ note: noteText })}
            disabled={busy || !noteText.trim()}
            className="mt-2 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Find stories in this note
          </button>
          <p className="mt-2 text-xs text-stone-400">
            Or connect your calendar and HubSpot below, and Ghostline reads
            the week for you.
          </p>
        </div>
      )}
    </div>
  );
}
