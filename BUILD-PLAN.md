# Ghostline - Build Plan

Kiroween 2026, Frankenstein category + Best Startup Project bonus.
Deadline: Friday Dec 4, 2026, 2:00pm PT (5:00pm ET).
Build started: Nov 16, 2026.

## The product (one line)

A founder talks for two minutes, an interview agent asks the follow-ups a good
ghostwriter would ask, and the app drafts a LinkedIn post from ONLY what the
founder actually said.

## MVP scope (what ships by Dec 4)

1. Record a voice note (up to 3 min) in the browser, or upload audio, or type.
2. Transcribe it with Whisper. Transcript shown, editable.
3. Voice fingerprint: 3 to 5 past LinkedIn posts so drafts sound like them.
4. Interview agent: up to 3 follow-up questions, one at a time, text chat,
   voice-note answers accepted. Skipped questions stay skipped, never invented.
5. Draft from transcript + interview answers + fingerprint only. Source note
   per paragraph. Two rewrites (plainer, shorter). House writing rules enforced.
6. Inline editing (founder's words win), schedule queue, copy to clipboard,
   mark posted. No auto-posting to LinkedIn in the MVP.
7. One-click demo mode with seeded data for the judges.

## Deliberately out of the MVP

- Live voice interview agent (Retell). Post-hackathon step.
- LinkedIn OAuth / auto-posting. Restricted API, out of scope.
- Payments, teams, analytics.

## Timeline

- Nov 16-17: spec (done), scaffold, Sab's sign-ins (Kiro login, Devpost
  registration, credits request).
- Nov 18-24: core build (voice note, transcription, interview, draft, edit).
- Nov 25-28: queue, polish, deploy live, end-to-end browser pass.
- Nov 29-Dec 1: demo video (under 3 min), Kiro usage write-up, submission draft.
- Dec 2-4: buffer, submit.

## Kiro usage (what the submission must show)

- Kiro CLI 3.3.0 installed in the sandbox (verified Nov 16).
- Spec-driven development: `.kiro/specs/ghostline/` (requirements, design,
  tasks) written before implementation.
- Steering docs: `.kiro/steering/product.md` and `tech.md`.
- Hooks: test suite + copy-rules check on save.
- Custom ghostwriter agent for the interview and draft flows.
- Public GitHub repo with `.kiro` at the root, open source license.
- Auth note: `kiro-cli whoami` returns "Not logged in" - sign-in is Sab's
  step (GitHub, Google, or AWS Builder ID), via device flow or Kiro IDE on
  his machine. Agent sessions need that login.

## Sab's steps (blocked items)

1. Register on Devpost for Kiroween 2026 and request the 4,000 free Kiro
   credits (Resources tab).
2. Sign in to Kiro so agent sessions can run (device-flow approval, or install
   Kiro IDE on his own machine).
3. API keys: a fresh Anthropic key named "ghostline" for the interview and
   drafting (separate from Sawa's key), and an OpenAI key for Whisper
   transcription. Both are small spends and need his explicit approval before
   any money moves. His Anthropic spend limit is $50/month (set Nov 16).

## Files

- `.kiro/specs/ghostline/requirements.md`
- `.kiro/specs/ghostline/design.md`
- `.kiro/specs/ghostline/tasks.md`
- `.kiro/steering/product.md`
- `.kiro/steering/tech.md`
