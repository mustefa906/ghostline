# Ghostline - Kiro Spec: Story Harvest (Tasks)

- [x] 1. Schema and store
  - [x] 1.1 Add `connections` and `story_leads` tables to `lib/schema.ts`
    (fields from design.md)
  - [x] 1.2 Add the Store interface methods from design.md and implement
    them in the Postgres store in `lib/store.ts`
  - [x] 1.3 Implement the same methods in the JSON store
    (`lib/json-store.ts`) so the feature runs with no DATABASE_URL
  - [x] 1.4 Write tests: connection save and delete (delete also removes
    that source's leads), lead create, list by week, status update

- [x] 2. Token handling
  - [x] 2.1 Build `lib/connections.ts`: AES-256-GCM encrypt and decrypt
    with `TOKEN_ENCRYPTION_KEY`, refresh with the stored refresh token,
    revoke on disconnect
  - [x] 2.2 Write tests: a token encrypts and decrypts back to the same
    value, a wrong key fails cleanly, an expired token refreshes once
    and marks the connection broken when the refresh fails

- [x] 3. Harvest prompts
  - [x] 3.1 Add `HARVEST_SYSTEM_PROMPT` and `buildHarvestUserMessage` to
    `lib/prompts.ts`, carrying the same discipline as the draft prompt:
    cite the source, never invent a number, a name, or a date, say
    plainly when nothing is post-worthy
  - [x] 3.2 Write tests: the prompt text passes the copy-rules check (no
    em dashes, no "X, not Y")

- [x] 4. Source fetchers and ranking
  - [x] 4.1 Build `lib/harvest.ts`: Google Calendar fetcher (last 7
    days, title, date, attendee count only) and HubSpot fetcher (deal
    stage changes in the window, name, stages, value, close date only)
  - [x] 4.2 Add the lead JSON parse and validation in `lib/harvest.ts`,
    following the interview route pattern (find the JSON block,
    validate the shape, reject the rest). Enforce the cap of 3 and drop
    any lead with no source reference.
  - [x] 4.3 Add the paste-a-note path: the same harvest on founder-pasted
    text, with the source label "Your note"
  - [x] 4.4 Write tests with fixtures: a closed-lost deal outranks a
    routine internal meeting, a lead with a real number outranks one
    with none, a lead with no number in the source contains no number,
    a malformed model reply stores no leads, an empty week returns the
    empty state

- [x] 5. Harvest route
  - [x] 5.1 Build POST /api/leads/harvest: load connections, fetch
    sources, load the last 10 draft first lines and this week's
    dismissed leads, one Claude call, store the leads, return them
  - [x] 5.2 Build GET /api/leads?week=YYYY-MM-DD and PATCH /api/leads/:id
    (dismiss with one of the three reasons, mark used)
  - [x] 5.3 Return a plain 503 when the Anthropic key is missing, the
    same way the interview and draft routes do
  - [x] 5.4 Write tests: harvest stores at most 3 leads, dismiss
    persists with its reason, a used lead is not offered again

- [x] 6. OAuth connections
  - [x] 6.1 Build the Google OAuth start and callback routes
    (calendar.readonly scope only)
  - [x] 6.2 Build the HubSpot OAuth start and callback routes
    (deals and contacts read-only scopes only)
  - [x] 6.3 Build GET /api/connections and DELETE
    /api/connections/:provider (revoke, delete tokens, delete the
    source's leads)
  - [x] 6.4 Write tests: a callback with a bad code fails cleanly, a
    disconnect removes tokens and leads, a broken connection reports
    its status

- [x] 7. Lead cards and dashboard
  - [x] 7.1 Build StoryLeads.tsx: the "This week" section, lead cards
    with title, what-happened, angle, source label, Talk about this,
    and Dismiss with the three reason choices
  - [x] 7.2 Wire the dashboard (app/page.tsx): run the harvest on load
    when the week has no leads, show the empty state with refresh when
    the harvest finds nothing, show the paste-a-note box when no source
    is connected
  - [x] 7.3 Build the settings connect cards (Google Calendar, HubSpot)
    with connected state, account label, and disconnect
  - [x] 7.4 Write tests: the card shows the source label, dismiss hides
    the lead, the empty state renders with a refresh action

- [x] 8. Lead-aware interview
  - [x] 8.1 Extend POST /api/interview to accept an optional `lead`
    object. When a lead is attached and no turns exist yet, return the
    lead's opening question directly with no model call, and persist
    the turn as usual.
  - [x] 8.2 Extend `buildInterviewUserMessage` with an optional lead
    argument, appended as context for questions only.
  - [x] 8.3 Show the picked lead above the record button on the recorder
    screen, and mark the lead used when the session is created.
  - [x] 8.4 Write tests: turn one from a lead needs no model call, the
    question cap still applies, a session without a lead behaves
    exactly as before

- [x] 9. Truth rule checks
  - [x] 9.1 Write tests: a draft from a lead session uses only the
    transcript, the answers, and the fingerprint. A fact that is in the
    source record but never said by the founder does not appear in the
    draft.
  - [x] 9.2 Write tests: the verification pass still checks the draft
    against the transcript and the answers only, and the source record
    never counts as evidence.
  - [x] 9.3 Run the copy-rules check (`node scripts/check-copy.mjs`)
    over the new user-facing strings and the new prompts.

- [x] 10. Demo mode and end-to-end pass
  - [x] 10.1 Add the demo fixtures to `lib/demo-seed.ts`: three fake
    calendar events and two fake HubSpot deal changes, producing two
    leads in demo mode with no real OAuth
  - [ ] 10.2 Full end-to-end pass in a real browser: connect (demo
    fixtures), harvest, pick a lead, record, interview, draft, edit,
    queue, copy. Confirm the draft contains no fact the founder never
    said.
  - [x] 10.3 Run the full suite (`npm test`) and the build
    (`npm run build`) green.

## Task 10 notes (Nov 23, 2026)

- 10.2 is NOT done and is left unchecked on purpose. The sandbox has no
  live browser tool and no live API keys, so the real-browser pass
  (record, interview, draft, edit, queue, copy) cannot run here. It
  needs Sab's browser with API keys set, after the code is pushed and
  deployed. Nothing about 10.2 was claimed as passed.

## Phase 1 notes

- The harvest is lazy plus manual refresh. No cron and no email digest
  in phase 1.
- The draft route and the verification prompt are deliberately
  unchanged. The only route that changes is the interview route, and
  only to accept the optional lead.
- OAuth app registration is Sab's step, once per provider, before task
  6 can be tested live: a Google Cloud OAuth client and a HubSpot
  developer app, with the redirect URIs for the callback routes, plus
  `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `HUBSPOT_CLIENT_ID`,
  `HUBSPOT_CLIENT_SECRET`, and `TOKEN_ENCRYPTION_KEY` as environment
  variables. Tasks 1 to 5 and 7 to 9 can be built and tested with
  fixtures before that step.
- Phase 2 (not in this spec): scheduled Monday digest (Netlify
  Scheduled Function plus an email provider), email and Slack sources,
  semantic dedup against past drafts, dismissal-reason learning, and
  the performance feedback loop.
