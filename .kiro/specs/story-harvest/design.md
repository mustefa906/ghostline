# Ghostline - Kiro Spec: Story Harvest (Design)

## Overview

Story Harvest adds a weekly story-finding step in front of the existing
Ghostline flow. It connects to the founder's Google Calendar and HubSpot
with read-only OAuth, reads the last 7 days, and asks Claude for up to 3
story leads for the current week. Each lead carries what happened, why it
matters, an opening question, and the source it came from. The founder
picks a lead, records a voice note about it, and the existing interview
and draft flow runs unchanged, except the first interview question comes
from the lead. The draft evidence base does not change: transcript plus
interview answers only. The source record shapes questions, never draft
claims.

The harvest is lazy in phase 1: it runs when the founder opens the
dashboard and no leads exist for the current week, plus a manual refresh.
There is no cron and no email digest in phase 1. Those are phase 2.

## Architecture

```
Browser (Next.js)
  - Settings: connect Google Calendar / HubSpot (OAuth)
  - Dashboard: "This week" lead cards (Talk about this / Dismiss)
  - Recorder: shows the picked lead above the record button
  - Interview chat UI: first question comes from the lead
  |
  v
Next.js API routes (new)
  - POST /api/connections/google      -> OAuth start (redirect to Google)
  - GET  /api/connections/google/callback -> code exchange, store tokens
  - POST /api/connections/hubspot     -> OAuth start (redirect to HubSpot)
  - GET  /api/connections/hubspot/callback -> code exchange, store tokens
  - GET  /api/connections             -> list connected sources + status
  - DELETE /api/connections/:provider -> revoke, delete tokens + source leads
  - POST /api/leads/harvest           -> fetch sources, Claude, store leads
  - GET  /api/leads?week=YYYY-MM-DD   -> list the week's leads
  - PATCH /api/leads/:id              -> dismiss (with reason) / mark used
  |
  v
Next.js API routes (changed)
  - POST /api/interview  -> accepts an optional lead object in the body.
    When a lead is attached and no turns exist yet, the route returns the
    lead's opening question directly, with no model call. Later questions
    pass the lead as context in the user message. Caps from the Ghostline
    spec still apply on the server.
  - POST /api/draft     -> unchanged. Evidence base stays transcript +
    interview answers. The verification prompt is unchanged.
  |
  v
Lib (new)
  - lib/harvest.ts        -> source fetchers (calendar, HubSpot), lead
    ranking, lead JSON parse and validation
  - lib/connections.ts    -> OAuth token encrypt, decrypt, refresh, revoke
  - lib/prompts.ts        -> add HARVEST_SYSTEM_PROMPT and
    buildHarvestUserMessage (prompts stay in this one file)
  |
  v
Postgres (same pattern as the Ghostline spec)
  - connections, story_leads (new tables, see Data model)
  - JSON file fallback through the same getStore() pattern when no
    DATABASE_URL is set
```

## Components

### Connections (settings)
- Two connect cards, Google Calendar and HubSpot, each showing connected
  or not, the account connected, and a disconnect action.
- OAuth start routes redirect to the provider with read-only scopes:
  Google `calendar.readonly`; HubSpot `crm.objects.deals.read` and
  `crm.objects.contacts.read`.
- Callback routes exchange the code, encrypt the tokens, and store one
  row per founder per provider.
- A broken connection (refresh failed) shows a plain message and a
  reconnect action. The rest of the app keeps working.

### Harvest
- Trigger: dashboard load with no leads for the current week, or the
  manual refresh action. One harvest per founder per week at most, unless
  the founder refreshes.
- Fetch step: for each connected source, pull the last 7 days only.
  Calendar: event title, start date, attendee count. HubSpot: deals with
  a stage change in the window, with deal name, old stage, new stage,
  value, and close date when present. No bodies, no notes, no emails.
- Prompt step: one Claude call with the compact source digest plus the
  first lines of the founder's last 10 drafts (already covered angles)
  and the founder's dismissed leads for the week. The harvest system
  prompt carries the same discipline as the draft prompt: cite the
  source, never invent a number, a name, or a date, and say plainly when
  nothing is post-worthy.
- Rank step: the model returns leads already ordered by the ranking
  rules (tension, specificity, freshness). The server enforces the cap
  of 3 and drops any lead with no source reference.
- Parse step: strict JSON parse with the same pattern as the interview
  route (find the JSON block, validate the shape, reject anything else).
  A failed parse means no leads are stored and the dashboard shows the
  empty state with a retry action.
- Cost: one Claude call per founder per week, on a small input. A few
  cents per founder per week at current pricing.

### Lead cards (StoryLeads.tsx)
- A "This week" section on the dashboard, above the queue. Up to 3
  cards, best first.
- Each card shows: the title, the one-line what-happened, the angle
  line, the source label, and the two actions (Talk about this,
  Dismiss). Dismiss opens the three reason choices.
- "Talk about this" creates a session with the lead id attached and
  opens the recorder with the lead shown above the record button. The
  lead is marked used when the session is created.
- Empty state: "Nothing post-worthy this week yet." with a refresh
  action and the paste-a-note fallback.

### Paste-a-note fallback
- When no source is connected, the dashboard offers a text box: "What
  happened this week?" The founder pastes a few lines. The harvest runs
  on that text alone and returns leads from it, with the source label
  "Your note". The same truth rules apply: the lead may only use what
  the note states.

### Lead-aware interview
- The interview route accepts an optional `lead` object: id, title,
  whatHappened, angle, openingQuestion, sourceLabel.
- Turn one: when a lead is attached and the turns list is empty, the
  route returns `{ kind: "question", text: lead.openingQuestion }`
  directly, with no model call, and persists the turn as usual.
- Later turns: `buildInterviewUserMessage` gains an optional lead
  argument. The lead is appended as context after the transcript and
  the history, labelled as context for questions only.
- The summary call is unchanged. The draft call is unchanged.

## Data model

New tables, same conventions as the Ghostline spec (uuid ids,
`created_at` defaults, cascade deletes on founder).

- **connection**: id, founder_id, provider ("google" | "hubspot"),
  account_label (the email or account name shown in settings),
  access_token_encrypted, refresh_token_encrypted,
  token_expires_at (nullable), status ("active" | "broken"),
  created_at, updated_at
- **story_lead**: id, founder_id, source_type ("calendar" | "hubspot" |
  "note"), source_ref (event id, deal id, or "note"), source_label
  (the human label shown on the card), title, what_happened, angle,
  opening_question, score (integer, higher is better), status ("new" |
  "used" | "dismissed" | "expired"), dismiss_reason (nullable, one of
  "not a story" | "too sensitive" | "already posted"), week_of (date,
  the Monday of the week), created_at

Store interface additions (in `lib/store.ts`, implemented for both the
Postgres store and the JSON store):
- `saveConnection(founderId, provider, tokens, accountLabel)`
- `getConnections(founderId)`
- `deleteConnection(founderId, provider)` (also deletes that source's
  leads)
- `createLeads(founderId, leads[])`
- `listLeads(founderId, weekOf)`
- `updateLead(id, patch)` (status, dismiss_reason)

Token encryption: AES-256-GCM with a key from the `TOKEN_ENCRYPTION_KEY`
environment variable. The key never ships in the repo. Tokens are
encrypted before they reach the store and decrypted only inside
`lib/connections.ts` at the moment of use.

## Demo mode

- Demo mode uses seeded fixtures: three fake calendar events (a sales
  call that ran long, a demo, a hiring interview) and two fake HubSpot
  deal changes (one Closed Won, one stuck in negotiation). The harvest
  runs on the fixtures and returns two leads, so a judge sees the full
  flow with no real OAuth.
- The fixtures live in `lib/demo-seed.ts` next to the existing demo
  founder seed.

## Non-goals for phase 1

- No scheduled Monday digest and no email. Harvest is lazy plus manual
  refresh. The digest is phase 2 (Netlify Scheduled Function plus an
  email provider).
- No email or Slack sources. Calendar and HubSpot only, plus the
  paste-a-note fallback.
- No semantic dedup. Avoiding repeat angles is prompt-level (the last
  10 draft first lines are in the harvest input). A real similarity
  check is phase 2.
- No dismissal-reason learning. Reasons are stored in phase 1 and used
  for ranking in phase 2.
- No auto-posting, no analytics dashboard, no teams, no payments. The
  Ghostline spec non-goals still apply.
- No storing full calendar events or full CRM records, ever.

## Open questions (Sab's steps)

- OAuth app registration is Sab's step, once, per provider: a Google
  Cloud OAuth client and a HubSpot developer app, both with the
  redirect URIs for the callback routes. The client ids and secrets go
  in as environment variables: `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, `HUBSPOT_CLIENT_ID`,
  `HUBSPOT_CLIENT_SECRET`, plus `TOKEN_ENCRYPTION_KEY`.
- HubSpot is the v1 CRM because it is the most common CRM for the ICP
  and Sab holds the HubSpot certification. Pipedrive is the named
  alternative if early users ask for it.
- The Monday email digest stays phase 2 unless Sab says otherwise. It
  needs an email provider choice (Resend is the current lean).
