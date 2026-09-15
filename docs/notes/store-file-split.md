# Workspace store split

Status: implemented, 2026-09-15. Second file in the size-review backlog.

The former 1,717-line storage/store.rs is now store/ with 17 files. This separates
existing responsibilities, rather than treating the line bands as hard limits.
The user clarified that cohesive larger files are acceptable and artificial
boundaries or substantial complexity solely to meet a count should be avoided.
AGENTS.md and the size inventory reflect that guidance.

## Responsibility map

- mod.rs: Store container, existing public exports and common validation helpers.
- workspace.rs: private directories and exclusive workspace ownership.
- schema.rs: current schema identity and validation.
- startup.rs: database/config initialization and default chat preparation.
- snapshot.rs: current application data projection and decoding.
- creation.rs: the existing shared persona/contact and conversation insertion helpers.
- commands/mod.rs: session/replay checks, exhaustive action dispatch, revision and
  receipt recording, and the single outer command transaction.
- commands/{partners,learning,conversations,assistance}.rs: typed command handlers
  borrowing that transaction, configuration, captured snapshot and speech cache.
- tests/: workspace, schema, preferences, transactions and lifecycle suites, with
  the existing small helpers in tests/mod.rs.

Handlers return the affected entity identity and record receipt scopes in their
borrowed context; they never commit independently. All 30 Action variants remain
explicitly dispatched. Existing Store methods and workspace exports remain at the
same Rust module paths. SQL/schema definitions and initialization ordering are
preserved. Borrowing the snapshot requires cloning the returned learner identity;
the receipt value is unchanged.

## Verification

- All 21 existing store tests preserved; added one regression for a handler failure
  after turn insertion. It verifies rollback of rows/revision/receipt, retry with
  the same action identity, and idempotent replay after successful retry.
- All 22 store tests passed. The new test fixture explicitly selects the configured
  AI route so it reaches the intended post-insertion modality failure.
- Generated-contract check, desktop build and 18 UI architecture tests passed.
- Final full native suite: 354 passed, 1 ignored, no failures.
- Clippy with warnings denied, Rust formatting, current documentation links and
  diff whitespace checks passed. Schema SQL files are unchanged.

Updated the native guide, AGENTS.md and the inventory. No other large implementation
was split. No data migration, manual app launch, deployment, commits or pushes.
Next candidate: native/src/application/mod.rs (1,501 lines).
