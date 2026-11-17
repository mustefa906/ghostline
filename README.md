# Ghostline

Talk for two minutes. Answer a few questions. Get a LinkedIn draft you can
stand behind.

Ghostline is a founder's ghostwriting process, productized. A founder records
a voice note about one idea, an interview agent asks the follow-ups a good
ghostwriter would ask, and the app drafts a LinkedIn post from **only** what
the founder actually said. It never writes from a prompt alone. A missing
detail stays missing, never invented.

Built for Kiroween 2026, Frankenstein category, plus the Best Startup Project
bonus. Deadline: Friday Dec 4, 2026, 2:00pm PT.

## The flow

1. **Voice note.** Record in the browser (MediaRecorder, 3-minute cap, timer,
   playback), upload audio (mp3, m4a, wav, webm, up to 25 MB), or type the
   idea instead.
2. **Transcription.** OpenAI Whisper turns the note into text. The transcript
   is editable before the interview starts.
3. **Voice fingerprint.** 3 to 5 past LinkedIn posts teach the app the
   founder's cadence, sentence length, and vocabulary. Fewer than 3 still
   works, with a plain warning that the voice match will be weaker.
4. **Interview.** An Anthropic Claude agent asks up to 3 follow-up questions,
   one at a time, about the problem, the moment, the number, or the lesson. A
   vague answer gets one clarifying question. Voice-note answers are accepted.
   Skipped questions stay skipped. A summary of what the founder said shows
   before drafting.
5. **Draft.** Generated from the transcript plus interview answers plus
   fingerprint only. House writing rules apply: kind, gentle, raw tone;
   simple hyphens, never em dashes; no defining a thing by its opposite;
   short spaced lines, one beat at a time. Each paragraph carries a source
   note. Two rewrites come with it: plainer, and shorter.
6. **Edit and queue.** Inline editing where the founder's words win, a
   date/time picker, a queue list, one-click copy to clipboard, and mark
   posted. Ghostline never posts to LinkedIn for you.

## Demo mode

On the home page, "Try the demo instead" loads a seeded demo founder (Maya
Chen, made-up), three fingerprint posts, and one finished example draft in
the queue. Demo mode is labeled clearly on screen. Recording a voice note in
demo mode runs the real transcription and interview flow.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

### Environment variables

| Variable | Needed for | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Postgres storage | Neon free tier. When empty or unreachable, the app falls back to a local JSON file store in `data/ghostline.json`, so it still runs end to end. |
| `OPENAI_API_KEY` | Whisper transcription | Without it, transcription returns a plain error telling you to set the key. |
| `ANTHROPIC_API_KEY` | Interview agent and draft engine | Without it, those routes return a plain error telling you to set the key. |
| `ANTHROPIC_MODEL` | Claude model | Defaults to `claude-sonnet-4-5`. |

Secrets live in environment variables only. Never commit a key, never print
one in a log.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Start the production server |
| `npm test` | Run the test suite (vitest) |
| `npm run check:copy` | Copy-rules check: no em dashes, no opposite definitions, across `app/`, `components/`, and `lib/` |

## Project layout

- `app/` - pages and API routes (`/api/transcribe`, `/api/interview`,
  `/api/draft`, `/api/posts`, `/api/founder`, `/api/fingerprint`,
  `/api/sessions`, `/api/demo`)
- `components/` - Recorder, InterviewChat, DraftView, QueueView,
  FingerprintForm
- `lib/` - Drizzle schema, Postgres and JSON stores, prompts, copy rules,
  validation, demo seed data
- `.kiro/specs/ghostline/` - requirements, design, tasks (written before
  implementation)
- `.kiro/steering/` - product and tech steering docs
- `scripts/check-copy.mjs` - the copy-rules hook equivalent (Kiro hooks need
  a Kiro sign-in, which is a separate step)

## Data model

- `founders` - id, name, linkedin_url, created_at
- `fingerprint_posts` - id, founder_id, body, created_at
- `sessions` - id, founder_id, transcript, status, created_at
- `interview_turns` - id, session_id, role, body, kind, created_at
- `drafts` - id, session_id, founder_id, body, source_note, version,
  edited_body, status, scheduled_for, created_at

## What is deliberately out of scope

- Live voice interview agent (Retell). Post-hackathon step.
- LinkedIn OAuth and auto-posting. Posting stays copy-to-clipboard.
- Payments, teams, analytics.
