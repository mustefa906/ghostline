# Ghostline - Kiro Spec: Design

## Overview

Ghostline is a Next.js App Router application (TypeScript, Tailwind) with API
routes for transcription, interview, and drafting. Audio is transcribed with
OpenAI Whisper. The interview agent and the draft generator run on Anthropic
Claude. Founder data (profile, fingerprint posts, drafts, queue) is stored in
Postgres. The live app is deployed on Netlify. No LinkedIn API posting in the
MVP: posting stays a copy-to-clipboard step, stated honestly in the submission.

## Architecture

```
Browser (Next.js)
  - Recorder (MediaRecorder) -> audio upload
  - Interview chat UI
  - Draft editor + schedule queue
  |
  v
Next.js API routes
  - POST /api/transcribe   -> Whisper (audio file in, transcript out)
  - POST /api/interview    -> Claude (transcript + history in, next question out)
  - POST /api/draft        -> Claude (transcript + answers + fingerprint in, draft out)
  - CRUD /api/posts        -> Postgres (drafts + queue)
  |
  v
Postgres (Neon free tier)
  - founders, fingerprint_posts, sessions, drafts, queue_items
```

## Components

### Recorder
- MediaRecorder with a 3-minute cap, live timer, playback before submit.
- Fallback: file upload (mp3, m4a, wav, webm, 25 MB max) or a plain text box.
- Sends audio as multipart form data to /api/transcribe.

### Interview
- A chat-style exchange, one question at a time, max 3 questions + 1 clarifying
  question per vague answer.
- The agent's system prompt carries the interview rules: ask for the problem,
  the moment, the number, the lesson; never ask two things at once; never
  suggest an answer the founder did not give.
- Answers can be text or a new voice note (transcribed the same way).

### Draft engine
- System prompt carries the house writing rules (steering/product.md) and the
  interview-first rule: use only transcript + interview answers + fingerprint.
- Output: the draft plus a source note mapping each paragraph to its source
  (transcript line or interview answer).
- Rewrite options: one plainer version, one shorter version, same sources.

### Queue
- Date/time picker per draft; list view of upcoming posts; copy-to-clipboard
  with a "mark posted" confirmation. No auto-posting.

## Data model

- **founder**: id, name, linkedin_url, created_at
- **fingerprint_post**: id, founder_id, body, created_at
- **session**: id, founder_id, transcript, status (recording, interviewing,
  drafting, done), created_at
- **interview_turn**: id, session_id, role (agent/founder), body, created_at
- **draft**: id, session_id, body, source_note, version (original/plain/short),
  edited_body, status (draft/queued/posted), scheduled_for, created_at

## Kiro usage (for the submission write-up)

- **Spec-driven development**: this spec (requirements, design, tasks) was written
  before implementation; tasks are executed in order and checked off in tasks.md.
- **Steering docs**: .kiro/steering/product.md (what Ghostline is, the
  interview-first rule, house writing rules) and .kiro/steering/tech.md (stack
  and conventions) guide every agent response.
- **Hooks**: a hook runs the test suite and a copy-rules check (no em dashes,
  no "X, not Y") on every file save in the draft engine.
- **Custom agent**: a "ghostwriter" agent with the interview and drafting
  prompts, used for the interview and draft flows.
- **MCP**: the Postgres MCP server lets the agent inspect the schema and seed
  data during development.
- **Powers**: the Next.js and testing powers for framework best practices.

## Non-goals for the MVP

- No LinkedIn OAuth or auto-posting (LinkedIn API access is restricted).
- No live voice agent (Retell) in the MVP; the interview is text chat with
  voice-note answers. A live voice interview is the post-hackathon step.
- No teams, no payments, no analytics dashboard.
- No mobile app; the web app is responsive.
