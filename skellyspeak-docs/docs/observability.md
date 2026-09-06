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

Chat and structured model calls through `ai.rs::Provider` record operation,
actor, timings, usage and each attempt's outcome. Each attempt captures the
structured messages, response and effective parameters after provider adaptation.
Headers and credentials are excluded. Messages and prompt blocks each have a
24,000-character budget; truncation is explicit.

Guided calls, standalone suggestions and interactive coach calls capture chat
ownership, trigger, selected difficulty, inferred proficiency notes, lesson
revision, partner snapshot and history counts. Replies and suggestions render
from named prompt blocks; recording checks that those blocks match the outgoing
system message. Other calls expose their actual system messages without that
fine-grained source breakdown. Context describes the operation's inputs; actual
messages show which inputs were sent to the model.

Reply and suggestion length diagnostics use punctuation and, for languages with
word delimiters, whitespace counts. They do not establish semantic difficulty or
CEFR compliance. Model-call success is separate from these checks and reply
application status: ready, rejected, or conversation saved. Operations without
an application acknowledgement explicitly report `not_reported`.

Retry usage accumulates, and each attempt retains its own request and response.
Reconciliation reports undeclared operations, declared-but-unobserved operations,
and dependency edges contradicted by observed timing. Speech/transcription,
pre-request preparation failures, skipped work and cancellation do not yet have
complete coverage in this recorder.

### AI activity panel

The shared panel opens directly on the live pipeline, with the latest interaction selected. Choose an exchange, standalone call, or all retained activity, filtered by chat. Standalone calls remain separate interactions. The call strip shows model names, elapsed durations, failures and running status; selecting a call opens its corresponding node. The graph displays recorded timing and token usage, and animates connections only while work is active.

Selection is shown with a labeled node outline, emphasized connections, and matching call/history highlights. Running, completed, retried and failed nodes have explicit status text; selection remains separate from execution state. Graph motion respects reduced-motion preferences.

Node details show an immediate response preview and model, then expandable usage, attempts, actual prompt and full raw response. **How it works** explains context and trace scope; **About this pipeline** exposes its declaration and inputs. All-retained mode shows the latest call per operation across exchanges.

**Debug** expands pause/resume/step, the advanced graph comparison workspace, session reconciliation checks, recorded-activity clearing and raw logs. The main graph remains visible. A paused pipeline always has a visible Resume action.

The trace and gate buses attach during Rust startup. Completed traces persist
atomically in `ai-traces.json`, bounded to 300 runs and 8 MiB. Oldest retained
records are evicted and the panel reports the eviction count. App version and
session identity accompany each run; this archive is independent of chat files.
Live start events are observed while the panel is mounted; opening it mid-call
does not reconstruct a missed start event. Snapshot/event overlap is deduplicated.

**Read / compare requests** opens a searchable full-height reader with captured
context, per-attempt messages and responses, and before/after prompt-block
comparison against another retained call of the same operation. **Export
selected** writes versioned JSON to `<app-config>/trace-exports/` and displays the
path. **Clear retained traces** clears the archive, not separately saved exports.
Current lesson choices remain editable in the Lesson panel.

A render or lazy-load failure is contained within the AI view with an explicit
error; it does not remove the conversation. Asynchronous data-load failures are
also shown. Docked, pop-out and mobile surfaces share this implementation.

## Security and privacy

IPC logging records command and argument names, not argument values. Run records
do contain prompt and output text, which can include conversation content.
These records are local diagnostics and must not be treated as anonymized
telemetry.

## Proposed work

The following does not exist yet:

- fine-grained prompt-block provenance for every operation;
- complete preparation, cancellation, skipped-work and speech traces;
- active-operation snapshots for panels opened mid-call;
- semantic difficulty evaluation beyond mechanical length checks;
- editable prompt registry/overrides;
- generated summaries of background model decisions;
- a full prompt workbench.

The design direction is documented in [Future Work](./future-work). New
observability features must continue to derive graphs from the execution
declaration and must visibly fail reconciliation when their claims drift from
observed behavior.

Mobile keeps the interactive graph at a readable starting zoom with pan/zoom controls and a navigation map. Fit View offers the complete graph at a smaller scale. Node details cover the graph and close with the dedicated control, Escape, or the platform back action.

Actual prompt inspection separates the recorded system, assistant and user messages into individual blocks so conversation history and message roles can be checked directly.

The [September 2026 instruction-flow audit](./ai-instruction-audit-2026-09-06)
is historical evidence from a local behavioral investigation. It maps setup and
per-operation instruction coverage and proposes extensions to this framework;
its original gap list predates the provenance and durable traces described above.
