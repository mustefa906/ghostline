"use client";

import { useEffect, useState } from "react";

type ConnectionInfo = {
  id: string;
  provider: string;
  accountLabel: string;
  status: string;
  createdAt: string;
};

type Props = {
  founderId: string;
};

const SOURCES = [
  {
    provider: "google",
    title: "Google Calendar",
    body: "Reads your calendar for the last 7 days: titles and dates only.",
  },
  {
    provider: "hubspot",
    title: "HubSpot",
    body: "Reads deal changes for the last 7 days: names, stages, and values only.",
  },
] as const;

export default function ConnectSources({ founderId }: Props) {
  const [connections, setConnections] = useState<ConnectionInfo[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const failed = params.get("connectionError");
    if (connected === "google") {
      setNotice("Connected to Google Calendar.");
    } else if (connected === "hubspot") {
      setNotice("Connected to HubSpot.");
    } else if (failed) {
      setNotice("That connection did not work. Try again.");
    }
    fetch(`/api/connections?founderId=${encodeURIComponent(founderId)}`)
      .then((res) => (res.ok ? res.json() : { connections: [] }))
      .then((data) => {
        setConnections((data.connections ?? []) as ConnectionInfo[]);
      })
      .catch(() => undefined);
  }, [founderId]);

  async function connect(provider: string) {
    setBusy(provider);
    setNotice(null);
    try {
      const res = await fetch(`/api/connections/${provider}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ founderId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start the connection.");
      window.location.href = data.url as string;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not start the connection.");
      setBusy(null);
    }
  }

  async function disconnect(provider: string) {
    setBusy(provider);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/connections/${provider}?founderId=${encodeURIComponent(founderId)}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not disconnect.");
      if (data.deleted) {
        setConnections((current) =>
          current.filter((c) => c.provider !== provider),
        );
        setNotice("Disconnected. The leads from that source are gone too.");
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not disconnect.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="font-display text-lg font-semibold">Connect a source</h2>
      <p className="mt-1 text-sm text-stone-600">
        Ghostline only reads the last 7 days, and only titles and deal
        changes. Nothing is stored except the leads themselves.
      </p>

      {notice && (
        <p className="mt-3 rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-700">
          {notice}
        </p>
      )}

      <ul className="mt-4 space-y-3">
        {SOURCES.map((source) => {
          const connection = connections.find(
            (c) => c.provider === source.provider,
          );
          const broken = connection?.status === "broken";
          return (
            <li
              key={source.provider}
              className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-stone-200 p-4"
            >
              <div>
                <p className="font-display text-base font-semibold">
                  {source.title}
                </p>
                <p className="mt-1 text-sm text-stone-600">{source.body}</p>
                {connection && (
                  <p className="mt-1 text-sm text-stone-600">
                    {broken
                      ? "That connection broke. Reconnect it."
                      : `Connected as ${connection.accountLabel}.`}
                  </p>
                )}
              </div>
              {connection && !broken ? (
                <button
                  type="button"
                  onClick={() => void disconnect(source.provider)}
                  disabled={busy === source.provider}
                  className="shrink-0 rounded-full bg-stone-100 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-200 disabled:opacity-50"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void connect(source.provider)}
                  disabled={busy === source.provider}
                  className="shrink-0 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy === source.provider
                    ? "Working..."
                    : broken
                      ? "Reconnect"
                      : "Connect"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
