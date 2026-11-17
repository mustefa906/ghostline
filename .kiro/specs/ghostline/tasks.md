# Ghostline - Kiro Spec: Tasks

- [x] 1. Project scaffold
  - [x] 1.1 Create the Next.js App Router + TypeScript + Tailwind project in
    `ghostline/`
  - [x] 1.2 Add Postgres (Neon) connection and the schema from design.md
  - [x] 1.3 Seed a demo founder with 3 fingerprint posts and one finished example
  - [ ] 1.4 Deploy a placeholder live URL so the deployment path is proven early
    (phase 2: no deploys in phase 1)
- [x] 2. Voice note capture
  - [x] 2.1 Build the recorder (MediaRecorder, 3-minute cap, timer, playback)
  - [x] 2.2 Add file upload (mp3, m4a, wav, webm, 25 MB) and the text fallback
  - [x] 2.3 Write tests: cap enforced, formats accepted, oversize rejected
- [x] 3. Transcription
  - [x] 3.1 Build POST /api/transcribe with Whisper
  - [x] 3.2 Show the transcript on screen, editable before the interview
  - [x] 3.3 Write tests: happy path, failure message, retry path
- [x] 4. Voice fingerprint
  - [x] 4.1 Build the profile form for 3 to 5 past LinkedIn posts
  - [x] 4.2 Store fingerprint posts per founder; warn when fewer than 3
- [x] 5. Interview agent
  - [x] 5.1 Build POST /api/interview with the interview system prompt
  - [x] 5.2 Build the chat UI: one question at a time, max 3 + clarifying
  - [x] 5.3 Accept voice-note answers (same transcription path)
  - [x] 5.4 Show the summary of what the founder said before drafting
  - [x] 5.5 Write tests: question count cap, skip handling, no invented detail
- [x] 6. Draft engine
  - [x] 6.1 Build POST /api/draft with the house writing rules and the
    interview-first rule
  - [x] 6.2 Show the draft with a source note per paragraph
  - [x] 6.3 Add the two rewrite options (plainer, shorter)
  - [x] 6.4 Add the copy-rules hook (no em dashes, no "X, not Y") on save
  - [x] 6.5 Write tests: missing detail is left out, rules are followed
- [x] 7. Edit and schedule queue
  - [x] 7.1 Build the inline draft editor (founder edits win, never overwritten)
  - [x] 7.2 Build the schedule queue (date/time picker, list view)
  - [x] 7.3 Add copy-to-clipboard and mark-posted confirmation
  - [x] 7.4 Write tests: edit persistence, queue ordering, empty state

- [ ] 8. Demo mode and polish
  - [x] 8.1 Add one-click demo mode with seeded data, clearly labeled
  - [ ] 8.2 Polish the landing page and the empty states
  - [ ] 8.3 Full end-to-end pass in a real browser: record, interview, draft,
    edit, queue, copy

- [ ] 9. Submission package
  - [ ] 9.1 Public GitHub repo with the .kiro directory at the root (NOT in
    .gitignore), open source license, README with setup instructions
  - [ ] 9.2 Live app URL verified in a real browser
  - [ ] 9.3 Demo video under 3 minutes on YouTube, showing the full flow
  - [ ] 9.4 Kiro usage write-up (specs, steering, hooks, agents, MCP, powers)
  - [ ] 9.5 Submit on Devpost: Frankenstein category + Best Startup Project
    bonus (founder + LinkedIn + startup website) before Dec 4, 2:00pm PT

## Phase 1 notes (Nov 16, 2026)

- Tasks 1-7 built and verified in the sandbox. See the phase 1 report.
- DATABASE_URL is not set in the sandbox, so the app runs on the local JSON
  file store (`data/ghostline.json`, gitignored). The Postgres schema and
  Drizzle code are in place and activate when DATABASE_URL is set.
- No API keys were available in the sandbox, so the live Whisper and Claude
  calls are untested. Both routes return a plain 503 telling the user to set
  the key. Testing them needs Sab's keys.
- 8.1 (demo mode) is done as part of phase 1. 8.2, 8.3, and all of 9 are
  phase 2.
