# Native deeper organization

Status: deferred future work, 2026-09-15. The user directed that implementation
splitting wait until the repository-wide folder reorganization is complete.
No Rust decomposition is authorized or implemented. The current, narrower proposal
is [native folder moves](folder-moves-proposal.md).

## Observed problems

| Current file | Lines | Mixed responsibilities |
| --- | ---: | --- |
| conversations/execution.rs | 6,808 | Turn admission/control, connection persistence, snapshots, dispatch, publication, speech lifecycle, approximately 4,880 lines of tests |
| storage/store.rs | 1,717 | Workspace ownership, database opening, command transaction/dispatch, domain mutations, application snapshot, tests |
| application/mod.rs | 1,501 | Runtime state, Tauri commands, credential I/O, partner generation, scheduler, startup, tests |
| learning/lessons.rs | 1,438 | Types, storage, quiz credit, lifecycle, prompts/schema, validation/publication, tests |
| model.rs | 997 | Types belonging to almost every domain, command envelope, errors, TypeScript export registry |

Line counts describe the current checkout. AGENTS.md now records the requested
200–500-line preference, danger zone above 500 through 1,000, and required
decomposition above 1,000. Automated enforcement is deferred with this work.
Split by ownership;
moving all tests into one giant file would leave the underlying problem intact.

## Recommended shape

Paths below are relative to `native/src/`. This lists changed areas; other cohesive
modules remain where they are. `mod.rs` files should provide a small module index
and deliberate public interface. A compact cohesive implementation may stay inline.

```text
application/
  startup.rs                 Tauri builder, windows/menu setup, registration
  state.rs                   Application, guards and shared runtime synchronization
  scheduler.rs               Background dispatch loop
  commands/                  Tauri wrappers grouped by responsible domain
    workspace.rs, conversations.rs, ai.rs, partners.rs, speech.rs
  contracts/                 Cross-domain command and application snapshot envelopes
    commands.rs, snapshots.rs, errors.rs, bindings.rs
  preferences.rs             Application appearance/onboarding preference types
conversations/
  types.rs                   Conversation, message, turn and operation records
  lifecycle.rs               Create/archive/delete/settings mutations from Store
  snapshot.rs                Conversation projection and pagination
  execution/
    admission.rs, turns.rs, dispatch.rs, publication.rs, recovery.rs
    tests/                   Admission, lifecycle, publication and recovery suites
  reading/                   Existing gloss module and reading result types
  prompts/                   Existing conversation prompt assembly
  revision/                  Existing revision logic and its types
learning/
  coaching/                  Observation, policy and coaching request modules
  learner/                   Learner state, practice settings and progression
  lessons/
    types.rs, repository.rs, lifecycle.rs, quiz.rs, prompts.rs, validation.rs
  rewards/                   Rewards and reward settings
partners/
  persona/                   Types, validation and prompt assembly
  generation/                Registry, runtime orchestration and durable receipts
  discovery/                 Mystery selection
  reactions.rs               Existing partner reaction module
speech/
  playback/                  Cache and speech request/cancel/result lifecycle
  recording/                 Capture, recording commands and transcription receipts
  analysis/                  Audio inspection and fluency timing
  types.rs                   Speech state and recording result types
ai/
  connections/               Access, routing, credentials, connection persistence
  hosted/                    Existing hosted and mobile sign-in modules
  transport/                 Text/speech providers and grouped completion support
  policy/                    Admission, holds and refusals
storage/
  workspace.rs               Directory permissions and exclusive ownership
  database.rs                Opening, schema initialization and validation
  store.rs                   Store container and transaction entry point
  schemas/                   Existing schema SQL files
  factory_reset.rs            Existing reset/export behavior
language/
  registry/                  Language lookup, types and citation tests
  linguistics/               Existing source-boundary and adapter code
  emoji.rs                   Existing Unicode/emoji helper
configuration/
  loading.rs                 Extract loading/initialization from mod.rs
  types.rs, validation.rs, citations.rs
statistics/
  types.rs, queries.rs        Usage records and summaries
```

## Ownership rules that matter

- Remove root `model.rs` by placing records with their domains. Only the combined
  application envelopes, shared error contract and export registry belong in
  `application/contracts/`. Preserve serialized names, field shapes and generated
  TypeScript output; do not replace the old catchall with a new catchall types file.
- Keep Tauri wrappers in `application/commands/`. Partner-generation orchestration
  belongs with generation, while the shared scheduler stays in application.
- Move connection persistence out of conversation execution into AI connections;
  move speech playback lifecycle into speech. Keep conversation execution as the
  coordinator for its turns and publication prerequisites.
- Extract domain mutations from `Store::execute` without changing its outer
  transaction, replay protection or revision checks. Domain handlers receive the
  existing transaction; they must not independently commit pieces of a command.
- Keep storage focused on workspace/database mechanics. Application-wide snapshot
  assembly belongs to application; conversation projections belong to conversations.
- Split provider files internally only where request building, streaming decoding
  and validation are separable. Do not introduce new transport abstractions solely
  to make files shorter.
- Keep tests with their owner. Large scenario suites may use an adjacent `tests/`
  folder grouped by behavior, with narrowly shared fixtures. Preserve cross-domain
  lifecycle tests at the coordinator that owns the guarantee they verify.
- Executable prompts stay with their domain and remain indexed from `content/`.
  Extracting editable prompt templates is separate work.

## Suggested implementation checkpoints

1. Application state/startup/commands/scheduler split, domain-owned types and bindings.
2. Execution split, extracting connection and speech responsibilities; group its tests.
3. Store transaction-preserving extraction and lessons decomposition.
4. Remaining folder grouping and any justified provider submodules.

Update AGENTS.md and the native guide at each checkpoint. Validate command
registration and contract output, formatting, Clippy and relevant native tests;
run the full native/UI suites and builds at the completed pass. No behavior changes,
new crates, schema changes, test deletion or new compatibility facades are proposed.

The alternative is a smaller mechanical pass: make each large file a folder with
implementation and tests files, retaining current responsibility mixtures. It has
less immediate code movement but leaves the ownership problems above unresolved.
Recommend the domain split, implemented through the checkpoints above.
