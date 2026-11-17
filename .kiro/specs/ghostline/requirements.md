# Ghostline - Kiro Spec: Requirements

## Introduction

Ghostline turns a founder's spoken thinking into LinkedIn posts that sound like them.
A founder talks for two minutes, an interview agent asks the follow-ups a good
ghostwriter would ask, and the app drafts a post from ONLY what the founder actually
said. It never writes from a prompt alone. That one rule is the product.

Category: Frankenstein (voice capture + interview agent + voice-matched drafting +
scheduling, stitched into one flow). Bonus: Best Startup Project.

## Glossary

- **Founder**: the user. A B2B founder who publishes on LinkedIn.
- **Voice note**: a short audio recording (up to 3 minutes) of the founder talking
  about one idea.
- **Voice fingerprint**: 3 to 5 of the founder's past LinkedIn posts, used to match
  their voice (cadence, sentence length, words they use, words they never use).
- **Interview**: a short agent-led exchange (up to 3 follow-up questions) that pulls
  the specifics out of the founder: the problem, the moment, the number, the lesson.
- **Draft**: a LinkedIn post generated from the transcript + interview answers +
  voice fingerprint. Never invents proof, numbers, or quotes.
- **Slot**: a scheduled publish time in the founder's queue.

## Requirements

### Requirement 1: Voice note capture

**User Story:** As a founder, I want to record a short voice note about one idea,
so that I can start a post without typing.

#### Acceptance Criteria

1. WHEN the founder opens a new post, THE Ghostline SHALL offer a record button
   that captures audio in the browser (MediaRecorder).
2. WHEN the founder stops recording, THE Ghostline SHALL show the audio length
   and let them play it back before continuing.
3. WHEN the founder uploads an existing audio file instead, THE Ghostline SHALL
   accept mp3, m4a, wav, and webm up to 25 MB.
4. WHEN the audio is longer than 3 minutes, THE Ghostline SHALL reject it with a
   plain message saying the limit is 3 minutes.
5. WHEN the founder prefers typing, THE Ghostline SHALL offer a text box as an
   alternative to recording, with the same downstream flow.

### Requirement 2: Transcription

**User Story:** As a founder, I want my voice note turned into text I can read,
so that the interview and the draft start from my actual words.

#### Acceptance Criteria

1. WHEN audio is submitted, THE Ghostline SHALL transcribe it with Whisper and
   show the transcript on screen.
2. WHEN transcription fails, THE Ghostline SHALL show the error in plain words
   and let the founder retry or type the idea instead.
3. WHEN the transcript is shown, THE Ghostline SHALL let the founder edit it
   before the interview starts.

### Requirement 3: Voice fingerprint

**User Story:** As a founder, I want the app to learn how I actually write,
so that drafts sound like me and not like every other AI post.

#### Acceptance Criteria

1. WHEN the founder sets up their profile, THE Ghostline SHALL accept 3 to 5
   past LinkedIn posts as their voice fingerprint.
2. WHEN fewer than 3 posts are given, THE Ghostline SHALL still work but SHALL
   say plainly that the voice match will be weaker.
3. WHEN a draft is generated, THE Ghostline SHALL use the fingerprint for
   cadence, sentence length, and vocabulary, and SHALL NOT copy whole sentences
   from the past posts into the new draft.

### Requirement 4: Interview agent

**User Story:** As a founder, I want the app to ask me the questions a good
ghostwriter would ask, so that the draft has something real in it.

#### Acceptance Criteria

1. WHEN the transcript is ready, THE Ghostline SHALL ask up to 3 follow-up
   questions, one at a time, aimed at specifics: the problem, the moment, the
   number, the lesson.
2. WHEN an answer is vague, THE Ghostline SHALL ask one clarifying question
   about it instead of moving on.
3. WHEN the founder answers by voice note, THE Ghostline SHALL transcribe the
   answer the same way as the first note.
4. WHEN the founder skips a question, THE Ghostline SHALL continue with what it
   has and SHALL NOT invent the missing detail later.
5. WHEN the interview ends, THE Ghostline SHALL show a short summary of what
   the founder actually said, before drafting.

### Requirement 5: Draft generation (the interview-first rule)

**User Story:** As a founder, I want a draft built only from what I said,
so that I can stand behind every line of it.

#### Acceptance Criteria

1. WHEN the draft is generated, THE Ghostline SHALL use only the transcript,
   the interview answers, and the voice fingerprint.
2. WHEN a detail is missing, THE Ghostline SHALL leave it out rather than
   inventing it.
3. WHEN the draft is generated, THE Ghostline SHALL follow the house writing
   rules: kind, gentle, raw tone; simple hyphens, never em dashes; no
   "X, not Y" constructions; short spaced lines, one beat at a time.
4. WHEN the draft is shown, THE Ghostline SHALL show which parts came from the
   transcript and which came from interview answers (a simple source note).
5. WHEN the founder dislikes the draft, THE Ghostline SHALL offer one rewrite
   in a plainer voice and one shorter version, both from the same source
   material.

### Requirement 6: Edit and schedule

**User Story:** As a founder, I want to fix the draft in my own words and put
it in a queue, so that posting is a decision, not a chore.

#### Acceptance Criteria

1. WHEN the draft is shown, THE Ghostline SHALL let the founder edit every
   line inline.
2. WHEN the founder edits, THE Ghostline SHALL keep the edited version as the
   version of record; the AI draft is never re-applied over their words.
3. WHEN the founder picks a date and time, THE Ghostline SHALL add the post to
   their schedule queue.
4. WHEN a queued post comes due, THE Ghostline SHALL show it as ready to copy,
   with one-click copy to clipboard, and mark it posted when the founder
   confirms.
5. WHEN the founder has no queued posts, THE Ghostline SHALL show an empty
   queue state, not an error.

### Requirement 7: Demo account for judging

**User Story:** As a judge, I want to try the app without signing up,
so that I can see the full flow in minutes.

#### Acceptance Criteria

1. WHEN the live app loads, THE Ghostline SHALL offer a one-click demo mode
   with a seeded founder profile, voice fingerprint, and one finished example.
2. WHEN demo mode is active, THE Ghostline SHALL label it clearly as a demo.
3. WHEN a judge records a voice note in demo mode, THE Ghostline SHALL run the
   real transcription and interview flow against it.
