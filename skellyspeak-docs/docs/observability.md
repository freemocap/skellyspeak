---
sidebar_position: 9
title: Observability
---

# Observability

SkellySpeak exposes its model workflow so developers can inspect what ran,
which dependencies were expected, and whether observed execution contradicted
the declaration.

## Current implementation

### Ontology

`src-tauri/src/ontology.rs` declares two agents:

- **Chat:** the in-character conversation partner.
- **Coach:** private feedback and the interactive coaching thread.

Tokenization, translation, explanation, suggestions, observation, speech, and
transcription are operations performed by the Rust runner or faculties. They
are not presented as additional autonomous agents.

### Turn declaration and graph

`src-tauri/src/turn_plan.rs` declares guided-turn operations, dependencies,
hydration behavior, conditional execution, and background work.
`src-tauri/src/graph.rs` derives the graph from that declaration. The graph
describes execution; `src-tauri/src/commands/guided/` executes it.

Learner-token analysis can begin before the partner reply completes. Reply
analysis fans out after the reply. Each result hydrates the UI as soon as it
lands; the analysis join reconciles state but does not gate rendering. The
observer is background work.

### Runs and reconciliation

Every model operation records a `Run` in `src-tauri/src/trace.rs`, including:

- operation and actor;
- turn lineage and model request profile;
- start, first-token, and duration timings;
- attempts, validation/rate-limit failures, and final outcome;
- provider-reported usage;
- final prompt text and raw output.

Retry usage is accumulated rather than replaced by the successful attempt.
Reconciliation reports undeclared operations, declared-but-unobserved
operations, and dependency edges contradicted by observed timing.

### Developer surfaces

The shared developer panel provides:

- a run list with request/attempt details;
- the generated React Flow graph and reconciliation banner;
- pause, resume, and bounded step controls implemented by
  `src-tauri/src/gate.rs`;
- docked, pop-out, and compact/mobile layouts.

The trace and gate buses are attached by the Rust application during startup.
Runs are process-local and can be cleared from the developer panel.

## Security and privacy

IPC logging records command and argument names, not argument values. Run records
do contain prompt and output text, which can include conversation content.
These records are local diagnostics and must not be treated as anonymized
telemetry.

## Proposed work

The following does not exist yet:

- durable run history across application restarts;
- structured prompt-block provenance;
- editable prompt registry/overrides;
- learner-facing summaries of background model decisions;
- a full prompt workbench.

The design direction is documented in [Future Work](./future-work). New
observability features must continue to derive graphs from the execution
declaration and must visibly fail reconciliation when their claims drift from
observed behavior.
