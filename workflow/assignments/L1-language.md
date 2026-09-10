# L1 — Source-linked passage analysis contract

Read ../README.md, ../../AGENTS.md, ../../DATA-MODEL.md (Source, assistance and
language analysis), ../../EXECUTION.md and ../../AI-EVALUATION.md. Report in
workflow/reports/L1.md. Own src-tauri/src/linguistics/ and pure tests there.

## Outcome

Specify a small, implementable token/gloss contract for one immutable partner
message. Build its deterministic source-mapping/validation core after documenting
the proposal. Scheduler/storage integration belongs to the coordinator.

## Contract proposal first

Specify source message identity/revision, language and analysis version; offset
units and frontend conversion; exact source coverage; word versus phrase spans;
punctuation/whitespace; optional gloss/pronunciation/romanization and provenance;
and explicit pending/failed/partial states. Address combining marks, emoji and
non-space-delimited scripts. Distinguish deterministic boundaries from linguistic
judgment. Never require the model to reproduce known source strings just to attach
metadata. Do not claim a word-only gloss cache is context-correct.

Choose a finite annotation unit and one bounded task initially. Explain the behavior
when output is incomplete or invalid and how a retry preserves source identity.
Propose the provider output shape; do not invent a second scheduler, retry loop,
credential path, database or UI-triggered request. Standard remains the initial
model role; Fast eligibility requires evaluation.

## Independent implementation

Pure source-span validation/segmentation utilities can proceed without a production
schema decision. Avoid new dependencies unless justified to integration. Include
fixtures with repeated words, punctuation, accents/combining marks, mixed scripts
and rejected overlapping/out-of-range spans. These are test fixtures, not runtime
sample data. If wiring a Rust module requires a reserved lib.rs change, hand over
that exact seam and do not claim the production build already runs the module.

## Acceptance

A worked source-to-annotation example, explicit choices/tradeoffs, deterministic
unit tests with exact execution instructions/results, and the proposed integration
seams. No paid provider evaluation or production wiring in this first assignment.
Integration reviews the shared contract before U1 binds to it.
