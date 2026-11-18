"use client";

import { useEffect, useState } from "react";
import DraftView, { type DraftData } from "@/components/DraftView";
import FingerprintForm from "@/components/FingerprintForm";
import InterviewChat, { type ChatTurn } from "@/components/InterviewChat";
import QueueView from "@/components/QueueView";
import Recorder, { type RecorderResult } from "@/components/Recorder";

type Founder = { id: string; name: string; linkedinUrl: string | null };

type Phase = "setup" | "profile" | "idea" | "interview" | "draft";

const FOUNDER_KEY = "ghostline-founder-id";

export default function Home() {
  const [founder, setFounder] = useState<Founder | null>(null);
  const [fingerprint, setFingerprint] = useState<string[]>([]);
  const [demo, setDemo] = useState(false);
  const [loadingFounder, setLoadingFounder] = useState(true);

  const [phase, setPhase] = useState<Phase>("setup");
  const [name, setName] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupBusy, setSetupBusy] = useState(false);

  const [transcript, setTranscript] = useState("");
  const [transcriptSaved, setTranscriptSaved] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ideaBusy, setIdeaBusy] = useState(false);
  const [ideaError, setIdeaError] = useState<string | null>(null);

  const [draftData, setDraftData] = useState<DraftData | null>(null);
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem(FOUNDER_KEY);
    if (!stored) {
      setLoadingFounder(false);
      return;
    }
    fetch(`/api/founder?id=${encodeURIComponent(stored)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.founder) {
          setFounder(data.founder);
          setFingerprint(data.fingerprint ?? []);
          setPhase("profile");
        } else {
          localStorage.removeItem(FOUNDER_KEY);
        }
      })
      .catch(() => undefined)
      .finally(() => setLoadingFounder(false));
  }, []);

  async function createProfile() {
    if (!name.trim()) {
      setSetupError("Add your name so the drafts know who they are for.");
      return;
    }
    setSetupBusy(true);
    setSetupError(null);
    try {
      const res = await fetch("/api/founder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), linkedinUrl: linkedinUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save your profile.");
      setFounder(data.founder);
      localStorage.setItem(FOUNDER_KEY, data.founder.id);
      setPhase("profile");
    } catch (e) {
      setSetupError(e instanceof Error ? e.message : "Could not save your profile.");
    } finally {
      setSetupBusy(false);
    }
  }

  async function enterDemo() {
    setSetupBusy(true);
    setSetupError(null);
    try {
      const res = await fetch("/api/demo", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Demo mode did not start.");
      setFounder(data.founder);
      setFingerprint(data.fingerprint ?? []);
      setDemo(true);
      localStorage.setItem(FOUNDER_KEY, data.founder.id);
      setRefreshKey((k) => k + 1);
      setPhase("profile");
    } catch (e) {
      setSetupError(e instanceof Error ? e.message : "Demo mode did not start.");
    } finally {
      setSetupBusy(false);
    }
  }

  function exitDemo() {
    setDemo(false);
    setFounder(null);
    setFingerprint([]);
    localStorage.removeItem(FOUNDER_KEY);
    setPhase("setup");
    setTranscript("");
    setSessionId(null);
    setDraftData(null);
  }

  function startNewPost() {
    setTranscript("");
    setSessionId(null);
    setDraftData(null);
    setIdeaError(null);
    setDraftError(null);
    setPhase("idea");
  }

  async function handleIdea(result: RecorderResult) {
    setIdeaBusy(true);
    setIdeaError(null);
    try {
      let text = "";
      if (result.kind === "text") {
        text = result.text;
      } else {
        const form = new FormData();
        form.append("audio", result.blob, `voice-note-${Date.now()}.webm`);
        const res = await fetch("/api/transcribe", {
          method: "POST",
          body: form,
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Transcription failed.");
        }
        text = data.transcript;
      }
      if (!founder) throw new Error("Set up your profile first.");
      const sessionRes = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ founderId: founder.id, transcript: text }),
      });
      const sessionData = await sessionRes.json();
      if (!sessionRes.ok) {
        throw new Error(sessionData.error ?? "Could not start a session.");
      }
      setTranscript(text);
      setTranscriptSaved(false);
      setSessionId(sessionData.session.id);
      setPhase("interview");
    } catch (e) {
      setIdeaError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setIdeaBusy(false);
    }
  }

  async function saveTranscript() {
    if (!sessionId) return;
    try {
      await fetch("/api/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sessionId, transcript }),
      });
      setTranscriptSaved(true);
      setTimeout(() => setTranscriptSaved(false), 2000);
    } catch {
      // The transcript still lives in the page when the save fails.
    }
  }

  function answersFromTurns(turns: ChatTurn[]) {
    const answers: { question: string; answer: string }[] = [];
    for (let i = 0; i < turns.length; i++) {
      const turn = turns[i];
      if (turn.role !== "agent") continue;
      const next = turns[i + 1];
      if (next && next.role === "founder" && next.body !== "[skipped]") {
        answers.push({ question: turn.body, answer: next.body });
      }
    }
    return answers;
  }

  async function generateDraft(turns: ChatTurn[]) {
    setDraftBusy(true);
    setDraftError(null);
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          answers: answersFromTurns(turns),
          fingerprint,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Drafting failed.");
      }
      setDraftData(data);
      setPhase("draft");
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : "Drafting failed.");
    } finally {
      setDraftBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-10">
      <header className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Ghostline</h1>
            <p className="mt-2 text-stone-600">
              Talk for two minutes. Answer a few questions. Get a draft you
              can stand behind.
            </p>
          </div>
          {founder && (
            <div className="shrink-0 text-right text-sm">
              <p className="font-semibold">{founder.name}</p>
              {founder.linkedinUrl && (
                <a
                  href={founder.linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brass underline underline-offset-2"
                >
                  LinkedIn
                </a>
              )}
            </div>
          )}
        </div>
        {demo && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-amber-100 px-4 py-2.5 text-sm font-medium text-amber-900">
            <span>
              Demo mode. This is sample data for Maya Chen, a made-up founder.
              Nothing here is real.
            </span>
            <button
              type="button"
              onClick={exitDemo}
              className="shrink-0 underline underline-offset-2"
            >
              Exit demo
            </button>
          </div>
        )}
      </header>

      {loadingFounder && (
        <p className="text-sm text-stone-500">Loading...</p>
      )}

      {!loadingFounder && !founder && (
        <section className="space-y-5">
          <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">How it works</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-stone-700">
              <li>
                Record a voice note about one idea, or type it out.
              </li>
              <li>
                An interview agent asks up to 3 follow-up questions, the ones
                a good ghostwriter would ask.
              </li>
              <li>
                You get a LinkedIn draft built only from what you said, with
                a note showing where each line came from.
              </li>
            </ol>
            <p className="mt-4 rounded-lg bg-stone-50 p-3 text-sm text-stone-600">
              The one rule: interview first. Ghostline never writes from a
              prompt alone. A missing detail stays missing, never invented.
            </p>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Set up your profile</h2>
            <label className="mt-4 block text-sm font-medium" htmlFor="name">
              Your name
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sab Ali"
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brass"
            />
            <label
              className="mt-4 block text-sm font-medium"
              htmlFor="linkedin"
            >
              LinkedIn URL (optional)
            </label>
            <input
              id="linkedin"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://www.linkedin.com/in/your-name"
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brass"
            />
            {setupError && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                {setupError}
              </p>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void createProfile()}
                disabled={setupBusy}
                className="rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {setupBusy ? "Saving..." : "Save my profile"}
              </button>
              <button
                type="button"
                onClick={() => void enterDemo()}
                disabled={setupBusy}
                className="rounded-full bg-stone-100 px-6 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-200 disabled:opacity-50"
              >
                Try the demo instead
              </button>
            </div>
          </div>
        </section>
      )}

      {founder && phase === "profile" && (
        <section className="space-y-5">
          <FingerprintForm
            founderId={founder.id}
            initialPosts={fingerprint}
            onSaved={(posts) => setFingerprint(posts)}
          />
          <button
            type="button"
            onClick={startNewPost}
            className="rounded-full bg-brass px-6 py-2.5 text-sm font-semibold text-white"
          >
            Start a new post
          </button>
        </section>
      )}

      {founder && phase === "idea" && (
        <section className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold">One idea, one voice note</h2>
            <p className="mt-1 text-sm text-stone-600">
              Talk about a single idea for up to 3 minutes. The interview and
              the draft start from your words.
            </p>
          </div>
          <Recorder
            onSubmit={(r) => void handleIdea(r)}
            busy={ideaBusy}
            submitLabel="Transcribe it"
          />
          {ideaError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              {ideaError}
            </p>
          )}
        </section>
      )}

      {founder && phase === "interview" && (
        <section className="space-y-5">
          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Your transcript</h2>
            <p className="mt-1 text-sm text-stone-600">
              Read it and fix anything the transcription got wrong before the
              interview starts.
            </p>
            <textarea
              value={transcript}
              onChange={(e) => {
                setTranscript(e.target.value);
                setTranscriptSaved(false);
              }}
              rows={5}
              className="mt-3 w-full rounded-lg border border-stone-300 p-3 text-sm leading-relaxed outline-none focus:border-brass"
            />
            <button
              type="button"
              onClick={() => void saveTranscript()}
              className="mt-2 rounded-full bg-stone-100 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-200"
            >
              {transcriptSaved ? "Saved" : "Save transcript edits"}
            </button>
          </div>

          <InterviewChat
            transcript={transcript}
            sessionId={sessionId}
            onFinish={(turns) => void generateDraft(turns)}
          />

          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-stone-600">
              Short on time? Skip the interview and draft straight from the
              transcript.
            </p>
            <button
              type="button"
              onClick={() => void generateDraft([])}
              disabled={draftBusy}
              className="mt-3 rounded-full bg-stone-100 px-5 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-200 disabled:opacity-50"
            >
              {draftBusy
                ? "Drafting..."
                : "Skip the interview, draft from the transcript"}
            </button>
            {draftError && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                {draftError}
              </p>
            )}
          </div>
        </section>
      )}

      {founder && phase === "draft" && draftData && (
        <section className="space-y-5">
          <DraftView
            data={draftData}
            sessionId={sessionId}
            founderId={founder.id}
            onSaved={() => setRefreshKey((k) => k + 1)}
          />
          <button
            type="button"
            onClick={startNewPost}
            className="rounded-full bg-stone-100 px-6 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-200"
          >
            Start another post
          </button>
        </section>
      )}

      {founder && (
        <section className="mt-10">
          <QueueView founderId={founder.id} refreshKey={refreshKey} />
        </section>
      )}

      <section className="mt-12">
        <h2 className="text-lg font-semibold">Watch how it works</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
          <iframe
            src="https://player.mediadelivery.net/embed/693077/4e2e2b68-bfd1-48ab-a420-609e8e3fbdd7?autoplay=false"
            loading="lazy"
            style={{ border: 0, width: "100%", aspectRatio: "16/9" }}
            allowFullScreen
            title="Ghostline explainer video"
          />
        </div>
      </section>

      <footer className="mt-12 border-t border-stone-200 pt-4 text-xs text-stone-400">
        Ghostline. Interview first, never write from a prompt alone. Built for
        Kiroween 2026.
      </footer>
    </main>
  );
}
