"use client";

import { useEffect, useState } from "react";
import DraftView, { type DraftData } from "@/components/DraftView";
import FingerprintForm from "@/components/FingerprintForm";
import InterviewChat, { type ChatTurn } from "@/components/InterviewChat";
import QueueView from "@/components/QueueView";
import Recorder, { type RecorderResult } from "@/components/Recorder";
import DemoLoop from "@/components/DemoLoop";
import FingerprintVisual from "@/components/FingerprintVisual";
import ProofStrip from "@/components/ProofStrip";
import Reveal from "@/components/Reveal";
import SampleDraftCard from "@/components/SampleDraftCard";
import StepIndicator from "@/components/StepIndicator";
import Waveform from "@/components/Waveform";

type Founder = { id: string; name: string; linkedinUrl: string | null };

type Phase = "setup" | "profile" | "idea" | "interview" | "draft";

const FOUNDER_KEY = "ghostline-founder-id";

// Which step the indicator highlights for each phase. Setup is -1,
// the flow has not started yet.
const STEP_FOR_PHASE: Record<Phase, number> = {
  setup: -1,
  profile: 0,
  idea: 0,
  interview: 1,
  draft: 2,
};

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
    <main className="min-h-screen">
      {loadingFounder && (
        <div className="mx-auto max-w-3xl px-4 py-10">
          <p className="text-sm text-stone-500">Loading...</p>
        </div>
      )}

      {!loadingFounder && !founder && (
        <>
          <section className="bg-ink text-stone-100">
            <div className="mx-auto max-w-5xl px-4 pb-16 pt-14 sm:pb-20 sm:pt-20">
              <div className="flex items-center justify-between gap-4">
                <p className="font-display text-xl font-semibold tracking-tight">
                  Ghostline
                </p>
                <a
                  href="#setup"
                  className="text-sm font-medium text-stone-300 underline underline-offset-4 hover:text-white"
                >
                  Set up my profile
                </a>
              </div>

              <Waveform bars={44} className="mb-6 mt-10" barClassName="bg-brass" />

              <h1 className="max-w-3xl font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                Talk for two minutes. Post something that&rsquo;s{" "}
                <em className="text-amber-500">actually yours.</em>
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-stone-300 sm:text-lg">
                Record one voice note. Answer up to three questions. Get a
                LinkedIn draft in your voice, with a note showing where each
                line came from.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void enterDemo()}
                  disabled={setupBusy}
                  className="min-h-[52px] rounded-full bg-brass px-8 py-3.5 text-base font-semibold text-white disabled:opacity-50"
                >
                  {setupBusy ? "Starting demo..." : "Try the demo"}
                </button>
                <a
                  href="#setup"
                  className="flex min-h-[52px] items-center justify-center rounded-full border border-stone-600 px-8 py-3.5 text-base font-semibold text-stone-100 hover:border-stone-400"
                >
                  Set up my profile
                </a>
              </div>
              <p className="mt-4 text-sm text-stone-400">
                No sign-up. The demo uses Maya Chen, a made-up founder.
              </p>

              <p className="mt-6 flex flex-wrap gap-2 text-xs font-medium text-stone-300">
                <span className="rounded-full bg-stone-800 px-3 py-1.5">
                  3 questions max
                </span>
                <span className="rounded-full bg-stone-800 px-3 py-1.5">
                  2 minutes of talking
                </span>
                <span className="rounded-full bg-stone-800 px-3 py-1.5">
                  Drafts only from your words
                </span>
              </p>
            </div>
          </section>

          <section className="mx-auto max-w-5xl px-4 py-14">
            <Reveal>
              <h2 className="font-display text-2xl font-semibold sm:text-3xl">
                Watch it work
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600 sm:text-base">
                One voice note, three questions, one draft. Here is the whole
                run with a sample founder.
              </p>
            </Reveal>
            <Reveal delay={100} className="mt-6 grid gap-5 lg:grid-cols-2">
              <DemoLoop />
              <SampleDraftCard />
            </Reveal>
          </section>

          <section className="mx-auto max-w-5xl px-4 pb-14">
            <Reveal>
              <h2 className="font-display text-2xl font-semibold sm:text-3xl">
                What you get
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600 sm:text-base">
                Every run ends with four things, all built from your words.
              </p>
            </Reveal>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                [
                  "The post",
                  "A LinkedIn draft in your voice, built only from what you said.",
                ],
                [
                  "A plainer rewrite",
                  "The same draft, plainer. Pick the one that sounds most like you.",
                ],
                [
                  "A shorter rewrite",
                  "The same draft, shorter. For days when less says more.",
                ],
                [
                  "A schedule queue",
                  "Save drafts, pick a time, then copy and post when it is due.",
                ],
              ].map(([title, body], i) => (
                <Reveal key={title} delay={i * 80} className="h-full">
                  <div className="h-full rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                    <p className="font-display text-lg font-semibold">{title}</p>
                    <p className="mt-2 text-sm leading-relaxed text-stone-600">
                      {body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          <section className="mx-auto max-w-5xl px-4 pb-14">
            <Reveal>
              <h2 className="font-display text-2xl font-semibold sm:text-3xl">
                How it works
              </h2>
            </Reveal>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {[
                [
                  "1",
                  "Record a voice note",
                  "Talk about one idea, or type it out. Up to 3 minutes.",
                ],
                [
                  "2",
                  "Answer the interview",
                  "An interview agent asks up to 3 follow-up questions, the ones a good ghostwriter would ask. 3 questions max.",
                ],
                [
                  "3",
                  "Get your draft",
                  "A LinkedIn draft built only from what you said, with a note showing where each line came from.",
                ],
              ].map(([step, title, body], i) => (
                <Reveal key={step} delay={i * 80} className="h-full">
                  <div className="h-full rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                    <p className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">
                      {step}
                    </p>
                    <p className="mt-3 font-display text-lg font-semibold">
                      {title}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-stone-600">
                      {body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal className="mt-4">
              <p className="rounded-lg bg-stone-100 p-4 text-sm text-stone-600">
                The one rule: interview first. Ghostline never writes from a
                prompt alone. A missing detail stays missing, never invented.
              </p>
            </Reveal>
          </section>

          <section className="mx-auto max-w-5xl px-4 pb-14">
            <Reveal>
              <h2 className="font-display text-2xl font-semibold sm:text-3xl">
                Your voice, learned from your own posts
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600 sm:text-base">
                Paste 3 to 5 of your past LinkedIn posts. Ghostline learns
                your cadence, your sentence length, and the words you use, so
                drafts sound like you.
              </p>
            </Reveal>
            <Reveal delay={100} className="mt-6">
              <FingerprintVisual />
            </Reveal>
          </section>

          <section className="mx-auto max-w-5xl px-4 pb-14">
            <Reveal>
              <ProofStrip />
            </Reveal>
          </section>

          <section
            id="setup"
            className="mx-auto max-w-3xl scroll-mt-6 px-4 pb-14"
          >
            <Reveal>
              <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
                <h2 className="font-display text-lg font-semibold">
                  Set up your profile
                </h2>
                <label
                  className="mt-4 block text-sm font-medium"
                  htmlFor="name"
                >
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
            </Reveal>
          </section>
        </>
      )}

      {founder && (
        <div className="mx-auto max-w-3xl px-4 py-10">
          <header className="mb-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="font-display text-3xl font-semibold tracking-tight">
                  Ghostline
                </h1>
                <p className="mt-2 text-stone-600">
                  Talk for two minutes. Answer a few questions. Get a draft
                  you can stand behind.
                </p>
              </div>
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
            </div>
            {demo && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-amber-100 px-4 py-2.5 text-sm font-medium text-amber-900">
                <span>
                  Demo mode. This is sample data for Maya Chen, a made-up
                  founder. Nothing here is real.
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

          <StepIndicator active={STEP_FOR_PHASE[phase]} />

          {phase === "profile" && (
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

          {phase === "idea" && (
            <section className="space-y-5">
              <div>
                <h2 className="font-display text-xl font-semibold">
                  One idea, one voice note
                </h2>
                <p className="mt-1 text-sm text-stone-600">
                  Talk about a single idea for up to 3 minutes. The interview
                  and the draft start from your words.
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

          {phase === "interview" && (
            <section className="space-y-5">
              <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
                <h2 className="font-display text-lg font-semibold">
                  Your transcript
                </h2>
                <p className="mt-1 text-sm text-stone-600">
                  Read it and fix anything the transcription got wrong before
                  the interview starts.
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
                  Short on time? Skip the interview and draft straight from
                  the transcript.
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

          {phase === "draft" && draftData && (
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

          <section className="mt-10">
            <QueueView founderId={founder.id} refreshKey={refreshKey} />
          </section>
        </div>
      )}

      <div className="mx-auto max-w-5xl px-4">
        <section className="mt-12">
          <h2 className="font-display text-lg font-semibold">
            Watch how it works
          </h2>
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

        <footer className="mt-12 border-t border-stone-200 pb-10 pt-4 text-xs text-stone-400">
          Ghostline. Interview first, never write from a prompt alone. Built
          for Kiroween 2026.
        </footer>
      </div>
    </main>
  );
}
