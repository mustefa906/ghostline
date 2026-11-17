// Demo seed data. Clearly labeled as a demo everywhere it appears.
// All copy follows the house rules: simple hyphens, spaced lines, and
// no defining a thing by its opposite.

export const DEMO_FOUNDER = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Maya Chen",
  linkedinUrl: "https://www.linkedin.com/in/maya-chen-demo",
};

export const DEMO_FINGERPRINT_POSTS = [
  `We lost a client this week.

It stung for a day.

Then I called them and asked what we missed.

They told me straight. Our onboarding was slow, and nobody owned the first week.

So we fixed the first week.

One owner. One call on day two. One check-in on day five.

Small changes. Big difference in how a new client feels.`,

  `I used to think a good week meant a full calendar.

Now I think a good week means one deep conversation.

A client told me something on Tuesday that changed our roadmap.

No meeting would have surfaced it. A real talk did.

Slow down. Ask one good question. Then listen.`,

  `Hiring our first support hire felt early.

It was the right call.

She answers in our voice because she helped write the playbook.

Customers notice. They tell us the replies feel human.

Hire for care. Teach the rest.`,
];

export const DEMO_TRANSCRIPT = `So the idea is this. We lost a client last month, and it hurt, but when I called them they were honest with me. Our onboarding was slow and nobody owned the first week. So we gave the first week one owner, one call on day two, one check-in on day five. And the next three clients all stayed. I think the lesson is that the first week is the whole relationship. If you get that right, the rest follows.`;

export const DEMO_INTERVIEW = [
  {
    question: "What exactly went wrong in that first week?",
    answer:
      "Nobody owned it. The client got three different contacts and no single person checking in.",
  },
  {
    question: "What changed after you gave the first week one owner?",
    answer:
      "The next three clients all stayed past the first month. Before that we were losing one in four.",
  },
  {
    question: "What would you tell a founder who is losing clients early?",
    answer:
      "Call the one you lost. Ask what you missed. Then fix that one thing first.",
  },
];

export const DEMO_DRAFT = `We lost a client last month.

It hurt.

So I called them and asked what we missed.

Nobody owned the first week.

Three contacts. No single person checking in.

So we changed it.

One owner for the first week. One call on day two. One check-in on day five.

The next three clients all stayed.

Before that, we were losing one in four.

The first week is the whole relationship.

Get that right, and the rest follows.`;

export const DEMO_SOURCE_NOTE = `Paragraph 1 to 3 came from the voice-note transcript. Paragraph 4 to 6 came from the interview answer about what went wrong. Paragraph 7 to 9 came from the interview answer about what changed. Paragraph 10 to 11 came from the interview answer about the lesson.`;

export function demoScheduledFor(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}
