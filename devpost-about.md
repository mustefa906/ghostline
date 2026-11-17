## Inspiration

I ghostwrite LinkedIn posts for B2B founders. The work always starts the same way: a call, where I ask the questions a ghostwriter would ask, and the founder talks. The post comes from what they said, never from a brief alone. A brief alone makes generic posts, and founders can tell.

The problem is the call. Founders do not have time for one every week, and I cannot scale myself. So I built the interview itself into software. Ghostline is the ghostwriter that interviews you first. You talk for two minutes, it asks the follow-ups I would ask, and then it drafts a post only from what you said.

The stakes are real. Founders post to be recognized, to be trusted, and to start conversations that turn into pipeline, hires, and partnerships. A post that sounds like a template earns none of that. A post that sounds like the founder, posted consistently, compounds. This is the same interview process I use with paying clients. One founder tripled his reach in the period we worked together.

## What it does

A founder records a voice note, up to three minutes, or uploads audio, or types. Whisper transcribes it. The app reads three to five of the founder's past LinkedIn posts and builds a voice fingerprint, so the draft sounds like them. Then an interview agent asks up to three follow-up questions, one at a time, the way I would on a call, including what the post is for. Pipeline, authority, brand awareness, hiring, whatever the founder is actually after, the draft is shaped toward that goal. When the founder is done, the draft is written from the transcript, the interview answers, and the fingerprint only. Anything missing is left out, never invented. Every paragraph carries a note saying where it came from. The founder edits it in place, schedules it, and copies it out when it is due.

## How I built it

I built Ghostline with Kiro, spec first. Before any code, I wrote requirements, a design doc, and a task list in the .kiro folder, plus steering docs that hold the one rule everything else follows: interview first, never write from a prompt alone. The stack is Next.js with TypeScript and Tailwind, Claude for the interview and the draft, Whisper for transcription, and Drizzle with Postgres for storage. A demo mode seeds a made-up founder so judges can try the full flow in a minute.

## Challenges I ran into

The hard part was not the code. It was holding the line on the rule. A model wants to fill gaps, smooth things over, and invent the missing detail. I had to make the draft step refuse to do that, leave the gap visible, and show its sources. The interview needed limits too. Three follow-ups, one clarifying question per vague answer, and a summary before drafting, so the conversation stays short and the founder stays in control. Getting a voice fingerprint from only three to five posts without copying the founder's words took the most tuning.

## What I learned

Writing the spec before the code changed how the build went. The requirements caught the edge cases early, and the steering docs kept every later decision honest to the first rule. I also learned that the product is the interview, not the draft. Anyone can generate a post. The value is in asking the right question at the right moment.

## What's next

A live voice interview agent, so the founder talks instead of typing, and posting straight to LinkedIn from the queue.
