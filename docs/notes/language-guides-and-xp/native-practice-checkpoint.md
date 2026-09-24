# Native practice publication checkpoint

Status: implemented and tested as native components, **not connected to the live
conversation graph or displayed XP**, 2026-09-24. The existing 45-skill evaluator
and old reward publication remain active until the coordinated cutover. No
application database was reset, app relaunched, deployment or commit performed.

## Implemented

- `native/src/learning/practice_assessment.rs`: compact presence-only Choice
  composition using supplied authored skill/language content. No hard-coded
  catalog size or language branches. Duplicate IDs, missing guidance, invalid
  criteria and request-budget overflow fail. Answers require complete catalog
  coverage, four valid probabilities, a selected maximum and valid confidence.
  Validated distributions remain available for inspection; none become XP weights.
- `native/src/learning/practice.rs`: transaction-bound practice publication on
  existing turns and their retained revision chains. Captures presence, experience,
  effort, XP, policy identity and the owning inference attempt. Requires a current
  running skill-assessment operation and rejects late/replaced sources. Invoke
  before completion changes the operation/attempt state to succeeded.
- Experience is first credited use in a chain. Changed retries credit effort for
  every previously encountered skill still present. A newly introduced skill earns
  experience. Unchanged text earns no further credit. Direct and contextual use
  count equally; absent and unclear do not count. No success or assistance weights.
- Exact duplicate publication is idempotent; conflicting publication fails. A
  caller transaction rollback removes the proposed award. Conversation/variety
  checks prevent unrelated chains from contributing prior experience. Only the
  new practice field is written; other message-rating context is preserved.

## Verification

`cargo test --manifest-path native/Cargo.toml --lib --quiet`: **599 passed,
5 intentionally ignored**. The first sandboxed attempt had 29 failures because
local mock HTTP servers could not bind; the complete rerun with loopback access
passed. No ignored/live-provider tests or paid inference were run.

Nine added tests cover the new native components: question composition and answer
validation, initial/retry counts, idempotency/conflicts, stale results, rollback,
conversation isolation and unrelated context preservation. The real-store test
uses ordinary send/revision commands, explicitly invokes the new publication
boundary with synthetic presence, then reopens the workspace and verifies credit.
This validates persistence behavior, not automatic dispatch or a live model call.

## Remaining integration

1. Replace the old catalog contracts with the accepted terse skill definitions and
   explicit language/variety guidance. Preserve the other agent's message-rating
   work; its grammar scores do not become practice signals.
2. Wire the presence builder/validator and practice publisher into skill-assessment
   completion, removing the old success/quote-dependent credit path for this flow.
   Preserve transport diagnostics and raw receipt ownership. No extra source-span
   call is needed for broad retry effort.
3. Project saved experience/effort into the UI and its XP totals. Native publication
   owns durable credit; the earlier TypeScript counter remains a review prototype,
   not a second durable award engine.
4. Exercise the actual dispatch → receipt → publication → visible XP path, including
   late results and restarts, before claiming the integrated pilot is implemented.
5. Build recommendation choices and the saved experience-profile write-up on those
   records, as specified in the main plan.
