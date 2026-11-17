# Ghostline - Tech Steering

## Stack

- Next.js App Router + TypeScript + Tailwind CSS
- Postgres (Neon free tier) via Drizzle
- OpenAI Whisper for transcription
- Anthropic Claude for the interview agent and draft generation
- Deployed on Netlify

## Conventions

- API routes live under `app/api/`. Each route validates its input and returns
  plain-word errors, never stack traces.
- Secrets live in environment variables only. Never commit a key, never print
  one in a log.
- The `.kiro` directory is committed to the repo and NEVER added to
  `.gitignore`. The submission requires it at the root.
- Every user-facing string follows the house writing rules: simple hyphens,
  no em dashes, no "X, not Y".
- Tests run on save via the Kiro hook. A failing test blocks the next task.
