## How I used Kiro

I built Ghostline with Kiro CLI, spec first. Before any code existed, I wrote the spec in .kiro/specs/ghostline: requirements, design, and tasks. The requirements set the seven things the app must do, from voice note capture to the schedule queue. The design set the stack and the rules for the interview agent. The tasks broke the build into nine groups in order. Nothing was coded until the spec was written.

Two steering docs guided every decision after that. .kiro/steering/product.md holds the one rule the whole product follows: interview first, never write from a prompt alone, plus the house writing rules. .kiro/steering/tech.md holds the stack, the secrets rule, and the rule that .kiro is never gitignored, so the spec and steering ship with the repo and judges can read them.

The copy rules are enforced by a hook equivalent. lib/copy-rules.ts holds the checks and scripts/check-copy.mjs runs them, with npm run check:copy. It catches em dashes and opposite-defining constructions before they reach a draft.

Kiro CLI ran the build from the spec and the steering docs, and the work was verified as it went: 21 tests across four files, all passing, plus a production build and a live pass over the full flow. The repo is public with the .kiro directory at the root, so the spec, the steering, and the code can all be read together.

I signed in to Kiro CLI with a Builder ID and used the CLI throughout. No custom agents, no MCP servers, no property-based testing. The spec, the steering docs, and the copy hook are the Kiro features this build rests on.
