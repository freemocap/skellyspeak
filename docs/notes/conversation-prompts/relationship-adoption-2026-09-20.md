# Relationship adoption — 2026-09-20

## Subsequent decision: shared English instructions

After reviewing the fresh 180-response instruction-language comparison, the user
chose English for maintainability; the experiment did not show a universal
quality winner. Implemented as `conversation-37-relationship-english`.
The shared interaction and Absolute Zero / Beginner / Intermediate descriptions
now use the English comparison wording. Language/variant/writing-system resolution,
persona/topic/tense composition, Advanced/Fluent guidance and temperature 1.1 remain.
No runtime imports from benchmark or notes files, and no per-language translations
were added to language configuration. Frozen experiments remain unchanged.
A new composition test covers six language/variant selections, three difficulties,
and both openings and replies, checking shared English behavior and resolved
writing/pragmatic guidance. Output quality remains a live evaluation concern.

Verification of the English adoption: 443 native tests passed, 2 ignored; the
native binary built successfully. The existing development app restarted and was
running as PID 311564 after the change. No paid calls or commits were made.

## Earlier decision and implementation (superseded wording)


The user selected Prompt 2 (Relationship), temperature 1.1, across Absolute Zero,
Beginner and Intermediate after reviewing the explorer. This supersedes the earlier
Prompt 6 recommendation. No further optimization or paid calls were performed.

## Implemented

Runtime instructions are in `content/prompts/conversation/instructions.yaml`,
assembled by the native builder as `conversation-36-relationship`. Relationship's
interaction and three difficulty descriptions replace the older prose. Language
identity is generalized; the app retains its language, persona, topic and tense
controls. Empty opening-angle configuration disables the old situation rotation;
examples remain empty. Advanced/Fluent descriptions are retained. Temperature 1.1
applies only to persona openings/replies across direct, streamed and grouped routes;
other tasks retain 0.7. Top-p/top-k are omitted and the selected app model is unchanged.
Prepared diagnostics now include temperature.

The tool README records how to resume and steer future rounds. `explorer/explore.ts`
rebuilds from cached data and serves the selected study locally without paid calls.
The latest study recommendation records the user's choice; earlier reports and
all seven frozen runs remain available.

## Verification

- Native library suite: 442 passed, 2 ignored. Initial sandbox run could not bind
  loopback sockets; rerunning with local socket access passed all 442 tests.
- Coverage includes actual direct and streaming temperature bodies, hosted/custom
  grouped requests, app opening dispatch, disabled forced situations, and all
  existing configuration/execution tests.
- Native development binary built successfully. Existing `tauri dev` watcher
  restarted the app; PID 283497 was running after the final rebuild.
- Explorer TypeScript check passed; 3 explorer tests passed.
- Offline viewer rebuilt: 1,680 responses / 1,191 unique embeddings; existing
  localhost server remains at port 8770.

## Remaining evaluation

No live app conversation was submitted during adoption. Start a new Spanish
conversation at each level, then evaluate replies, clarification, refusal, topic
changes and endings. The selected study measures independent Spanish openings;
multilingual, full-persona and multi-turn behavior are not established by it.
This implementation is a faithful adaptation of the selected strategy, not an
assertion that the full app request equals the synthetic experiment byte for byte.

No commit was created; all changes remain in the working tree.
