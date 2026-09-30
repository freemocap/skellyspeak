# Suggestion controls and sentence blanks

Implemented 2026-09-30; source changes remain uncommitted.

## Implemented behavior

- Reply suggestions and sentence starters use the shared TargetMessage toolbar.
  Analysis defaults to the shared reading inspector, while saved conversation
  messages keep their owner-supplied analysis handlers.
- Starters declare template syntax, so underscore runs can touch surrounding
  words without requiring spaces or language-specific rules. Ordinary text treats
  only standalone runs as blanks, preserving identifiers such as `snake_case`.
- Opening a blank requests completion options with the original sentence as
  context. The explicit `completions` reading aid distinguishes template requests
  in execution receipts and cache identity. Standalone blanks in ordinary reading
  also receive completion help through analysis.
- Results use the existing explanation-card shape. Validation requires two or
  three distinct completed sentences, nonempty fills, and unchanged text outside
  the slots. Suggestions are not spelling, pronunciation, or learner evidence.
- Saved glosses cannot turn placeholders into vocabulary. Unannotated portions
  of saved text retain their full source and offsets for contextual help.
- Completion sentences have standard reading controls themselves. Rendering is
  passive; deliberate hover, click, keyboard activation or Analysis requests help.
  Failures retain diagnostics and require explicit retry.

## Verification

- Shared reading, suggestion, source-preservation and template tests pass,
  including adjacent slots, multiple scripts, canonical encodings, identifiers,
  stale annotation handling, analysis, insertion and explicit retry.
- All 46 native tests selected by `reading` pass.
- Full interface suite: 1,569 passed; one concurrent, unrelated status-label
  localization test failed because its new source string was absent from the
  English catalog. Those files were not changed for this work.
- The offline browser fixture verifies compact toolbar overflow, starter analysis
  and a readable two-option blank popup. It uses deterministic example results.

## Shared-control audit follow-up (2026-09-30)

Implemented: Words replaces the longer toolbar label across interface locales,
tour guidance and fixtures. MessageFeedback supplies Coach for learner messages;
TargetMessage retains Analysis for target text. Shared tool definitions now own
these labels and detail-dialog semantics. MessageTools continues to own rendering,
overflow and accessibility. The Drill tour and live preview now use TargetMessage
instead of assembling their own message markup.

Conversation and coach copies share TurnView. The learner composition retains
its source-owned editing, recording, feedback and saved reading state; suggestions,
starters and completed examples share TargetMessage and the reading service.
Inline phrase controls remain intentionally inline rather than full bubbles.

Verification: 284 focused tests pass across 31 files, including coach-copy parity,
learner Coach versus partner Analysis, reading controls and suggestions. Interface
and preview type checks pass; fast validation passed before subsequent concurrent
edits. Component documentation was regenerated. A full-suite run passed 1,557
tests and failed 19 in concurrent status/practice-card work (missing translations
and changed starter titles), with two associated uncaught localization errors.
No installed-application check was performed for this label follow-up.

## Runtime limits

No live provider generation or installed-application restart was performed.
Structural validation preserves the source but cannot prove the linguistic
quality of generated choices. The existing reading service owns reuse,
cancellation and diagnostic receipts; this adds no learner records or credit.
