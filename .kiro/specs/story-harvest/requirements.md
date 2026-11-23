# Ghostline - Kiro Spec: Story Harvest (Requirements)

## Introduction

Story Harvest is the feature that finds the story for the founder. Today
Ghostline waits for the founder to show up with a topic. Founders do not.
This feature reads the founder's week, from their calendar and their CRM,
and brings them three story leads: what happened, why it is worth posting
about, and the first question the interview would ask. The founder still
talks for two minutes. The lead is a prompt, never a substitute for their
own words. The interview-first rule does not change.

This spec extends the Ghostline spec. It adds Requirements 8 to 15 below.
Requirements 1 to 7 of the Ghostline spec still apply in full, including
the draft rule that a draft uses only the transcript, the interview
answers, and the voice fingerprint.

## Glossary

- **Story lead**: one proposed post topic, drawn from a real event in the
  founder's week. It carries what happened, why it matters, an opening
  question, and the source it came from.
- **Harvest**: the weekly run that reads connected sources and produces up
  to 3 story leads for the current week.
- **Connection**: a founder's link to one source, Google Calendar or
  HubSpot, made with OAuth and read-only scopes. The founder can remove it
  at any time.
- **Source**: one record behind a lead. A calendar event (title and date)
  or a HubSpot deal change (deal name and stage change).
- **Week**: the Monday-to-Sunday week the leads belong to. Leads are
  generated fresh each week and expire with it.
- **Dismiss**: the founder's action of rejecting a lead, with a short
  reason. Dismissed leads are kept out of the week and the reason is
  stored.

## Requirements

### Requirement 8: Connect sources

**User Story:** As a founder, I want to connect my calendar and my CRM,
so that Ghostline can see what actually happened in my week.

#### Acceptance Criteria

1. WHEN the founder opens settings, THE Ghostline SHALL offer to connect
   Google Calendar and HubSpot, each as a separate connection.
2. WHEN the founder connects Google Calendar, THE Ghostline SHALL ask for
   read-only calendar access and nothing wider.
3. WHEN the founder connects HubSpot, THE Ghostline SHALL ask for read-only
   access to deals and contacts and nothing wider.
4. WHEN a connection is made, THE Ghostline SHALL store the access and
   refresh tokens encrypted, and SHALL never show a token value on screen.
5. WHEN the founder disconnects a source, THE Ghostline SHALL revoke the
   token, delete the stored tokens, and delete the leads that came from
   that source.
6. WHEN no source is connected, THE Ghostline SHALL still work: the
   founder can paste a short note about their week and get leads from it,
   and the normal record-first flow stays available.

### Requirement 9: Weekly harvest

**User Story:** As a founder, I want three story leads waiting for me each
week, so that I never open the app to a blank page.

#### Acceptance Criteria

1. WHEN the founder opens the dashboard and no leads exist for the
   current week, THE Ghostline SHALL run a harvest for that week.
2. WHEN a harvest runs, THE Ghostline SHALL read only the last 7 days
   from each connected source: calendar events and HubSpot deal changes.
3. WHEN a harvest runs, THE Ghostline SHALL produce at most 3 leads for
   the week.
4. WHEN the founder asks for fresh leads, THE Ghostline SHALL offer a
   refresh action that re-runs the harvest for the current week.
5. WHEN a harvest finds nothing post-worthy, THE Ghostline SHALL show an
   empty state that says so plainly, and SHALL NOT invent a lead.
6. WHEN the week ends, THE Ghostline SHALL mark the week's unused leads
   as expired and start the next week empty.

### Requirement 10: Lead content

**User Story:** As a founder, I want each lead to tell me what happened
and why it matters, so that I can tell in seconds whether it is worth
talking about.

#### Acceptance Criteria

1. WHEN a lead is shown, THE Ghostline SHALL show what happened in one
   plain line, grounded in the source record.
2. WHEN a lead is shown, THE Ghostline SHALL show the source it came
   from, with a label the founder recognises, such as "Sales call, Tue
   Nov 24" or "HubSpot: Acme moved to Closed Won".
3. WHEN a lead is shown, THE Ghostline SHALL show one angle line: the
   tension, the lesson, or the number that makes it post-worthy.
4. WHEN a lead is shown, THE Ghostline SHALL show the opening question
   the interview would ask first about this lead.
5. WHEN a lead cites a number, a name, or a date, THE Ghostline SHALL
   take it only from the source record, and SHALL leave it out when the
   source record does not state it.
6. WHEN a lead repeats an angle the founder already posted about, THE
   Ghostline SHALL deprioritise it. The harvest sees the first lines of
   the founder's last 10 drafts and SHALL NOT propose the same angle
   twice.

### Requirement 11: Lead ranking

**User Story:** As a founder, I want the best stories first, so that the
top lead is the one most worth my two minutes.

#### Acceptance Criteria

1. WHEN leads are ranked, THE Ghostline SHALL rank tension first: a deal
   lost, a deal almost lost, an objection, a churn save, or a first of
   any kind outranks a routine meeting.
2. WHEN leads are ranked, THE Ghostline SHALL rank specificity next: a
   lead with a real number, a real name, or a real moment outranks a
   lead with none.
3. WHEN leads are ranked, THE Ghostline SHALL rank freshness next: an
   event from this week outranks an older one.
4. WHEN the founder dismisses a lead with a reason, THE Ghostline SHALL
   store the reason with the lead.

### Requirement 12: Lead cards

**User Story:** As a founder, I want to act on a lead in one tap, so that
a good lead turns into a post and a bad lead disappears.

#### Acceptance Criteria

1. WHEN the dashboard loads, THE Ghostline SHALL show this week's leads
   as cards in a "This week" section, best first.
2. WHEN a lead card is shown, THE Ghostline SHALL offer "Talk about
   this" and "Dismiss" as the two actions.
3. WHEN the founder taps "Talk about this", THE Ghostline SHALL start a
   session with the lead attached, showing the lead on the record screen.
4. WHEN the founder taps "Dismiss", THE Ghostline SHALL ask for a short
   reason with three choices: "not a story", "too sensitive", or
   "already posted", and SHALL remove the lead from the week.
5. WHEN a lead has been used for a session, THE Ghostline SHALL mark it
   used and SHALL NOT offer it again.
6. WHEN the founder has no leads for the week, THE Ghostline SHALL show
   the empty state from Requirement 9, with a refresh action.

### Requirement 13: Lead-aware interview

**User Story:** As a founder, I want the interview to start from the
lead I picked, so that the first question is already about the story.

#### Acceptance Criteria

1. WHEN a session starts from a lead, THE Ghostline SHALL still ask the
   founder to record a voice note about the lead first. A lead never
   replaces the founder's own words.
2. WHEN the interview starts from a lead and no question has been asked
   yet, THE Ghostline SHALL ask the lead's opening question first, with
   no model call for that turn.
3. WHEN later questions are asked, THE Ghostline SHALL give the model the
   lead (what happened, the angle, the source label) as context for its
   questions.
4. WHEN the interviewer asks about a fact from the source record, such
   as a deal value, THE Ghostline SHALL phrase it as a question to the
   founder, and SHALL treat only what the founder confirms as usable
   for the draft.
5. WHEN the interview ends, THE Ghostline SHALL show the same summary
   as a normal interview, from the transcript and the answers only.

### Requirement 14: Truth rule preserved

**User Story:** As a founder, I want the same guarantee as before, that
every line of a draft comes from what I actually said.

#### Acceptance Criteria

1. WHEN a draft is generated from a lead session, THE Ghostline SHALL
   use only the transcript, the interview answers, and the voice
   fingerprint, exactly as Requirement 5 states.
2. WHEN a fact appears in the source record but the founder never said
   it in the transcript or the answers, THE Ghostline SHALL NOT put it
   in the draft.
3. WHEN the verification pass checks a draft from a lead session, THE
   Ghostline SHALL check it against the transcript and the answers
   only. The source record never counts as evidence.
4. WHEN a lead session produces a draft, THE Ghostline SHALL show the
   same source note per paragraph as a normal draft, plus the lead it
   started from.

### Requirement 15: Privacy and storage

**User Story:** As a founder, I want my calendar and CRM data handled
carefully, so that connecting them feels safe.

#### Acceptance Criteria

1. WHEN a harvest runs, THE Ghostline SHALL fetch only event titles,
   dates, and attendee counts from the calendar, and only deal names,
   stage changes, and values from HubSpot. It SHALL NOT fetch event
   bodies, meeting notes, emails, or full contact records.
2. WHEN a harvest runs, THE Ghostline SHALL store the lead and a
   reference to its source, and SHALL NOT store the full calendar event
   or the full CRM record.
3. WHEN a token expires, THE Ghostline SHALL refresh it with the stored
   refresh token, and SHALL mark the connection as broken when the
   refresh fails, with a plain message and a reconnect action.
4. WHEN demo mode is active, THE Ghostline SHALL use seeded calendar
   and HubSpot fixtures, and SHALL NOT ask for real OAuth.
