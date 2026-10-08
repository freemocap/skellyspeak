# Native graph inspection export

Status: implementation contract for the isolated foundation, protocol 1,
2026-10-08. Extends [the foundations](ai-graph-foundations.md) and
[durable owner boundary](ai-graph-durability.md). No production workflow, IPC
command or activity viewer is connected by this change.

## One structural representation

`Artifact<V>`, `Definition<V>`, `Node<V>`, `Boundary<V>` and `Source<V>` are the
same Rust types used by execution and inspection. Execution uses JSON constants;
inspection substitutes `ConstantDisclosure` through a total structural mapping.
Only constant values change. Ports, bindings, controls, guards, composition
boundaries, implementation IDs and type contracts remain identical. New fields
and enum variants require exhaustive mapping changes in the native owner, not a
viewer catalog. The existing executable/checkpoint serialization is unchanged by
these type parameters.

Attempts, attempt states and reasons similarly use shared parameterized types.
The exporter copies native dispositions, effective activation and reasons; it does
not reevaluate scheduling or infer state from absent records. Explicit paused and
active flags retain run-level facts even when a node is already prepared/running.

`DurableEngine::inspection_snapshot` produces one immutable snapshot containing
protocol, engine UUID, revision, run identity, artifact identity, full structure
and runtime facts. Revision must match the committed checkpoint. A host with an
uncertain commit refuses export until it reloads. Engine, revision and artifact
identity are required when comparing snapshots; an older revision must not replace
a newer one in a future client. A changed artifact is a different structure.

`Executable::inspection_definition` exports the identical artifact without any
run fields, even before an engine/run exists. It does not create a synthetic run
or label dormant definitions as successful. Both entry points use the same
structural projection; changing run selection cannot change that artifact.

`Checkpoint::inspection_definition` uses that same projection on the exact saved
artifact. No registry or executable handlers are needed, even after the original
implementation has been removed. `artifact_ids` lists the retained manifest; decode
checks each artifact's identity with the compiler's unchanged fingerprint algorithm.
This is historical definition access, not handler-free runtime reconstruction or
permission to resume old work. Runtime recovery still requires exact executable
bindings. See the [retention contract](ai-graph-retention.md).

All attempt/execution IDs and the revision are decimal strings in this protocol,
avoiding JavaScript integer rounding. Internal checkpoint IDs remain unchanged.
Snapshots do not contain checkpoint checksums, run inputs, result values, scopes
or credentials. The artifact ID still identifies the original executable artifact,
not a newly hashed redacted graph. A disclosed artifact is not executable.

## Disclosure and trust boundary

Graph/operation/type/port identities, shape field names and implementation IDs are
authored public schema. Run IDs must be opaque owner-assigned identities. These
structural fields must never contain learner content, credentials or private host
paths. This is a construction contract for trusted native definitions, not a
sanitizer for arbitrary user-authored schemas. Redacting those identities would
break parity; sensitive values belong in typed inputs or explicit constants.

Every constant, including values in captured subgraph definitions and bindings,
is replaced with an explicit `Content` omission. This includes boolean and numeric
constants; runtime facts already report guard outcomes. Source content is not
copied into the export to let the UI reconstruct eligibility.

Native faults now use one closed `CoreFaultCode` vocabulary in the implementation.
Export preserves recognized codes and known structural paths. Arbitrary adapter
code/path fields receive explicit `Unclassified` omissions, including in reasons;
their original records remain unchanged internally. There is no guess that a
short string or a provider message is safe merely because it is called a code.

This closes disclosure for the current code/path-only core fault model. It does
**not** implement provider metadata retention or license replacing richer provider
errors with these fields. Provider integration remains gated on typed bounded
metadata and the shared diagnostic sensitivity policy, preserving request IDs,
models, finish reasons, timing, retry/rate-limit facts, billing/usage provenance,
validation details and explicit redaction/truncation. Existing provider diagnostics
are not changed or routed through this exporter.

Export limits fail explicitly on excessive attempts or bytes. They never return
half a graph, drop edges, or truncate history without disclosure. A future paged
history protocol must retain complete structure and identify omitted history.

## Generated client contract and verification

`npm run contracts` generates `ui/src/generated/graph-contracts.ts` directly from
these Rust types; `npm run contracts:check` verifies it. The generic value/failure/ID
arguments identify the export specialization without duplicating the ontology in
TypeScript. `InspectionSnapshot` and `DefinitionSnapshot` are the transport types;
generic defaults describe the internal model and are not additional IPC endpoints.
No operation-specific frontend registrations are introduced.

Native regression tests compare the entire nested exported artifact with the
executable artifact after independently substituting only constant values. Tests
also check dormant/disabled nodes, authoritative reasons, unchanged raw data,
large IDs, classified/unclassified failure disclosure, limits and uncertain-host
rejection. Renderer visibility and workflow integration remain subsequent gates.

## Verification checkpoint — 2026-10-08

On branch `graphs`, with changes left uncommitted:

- Final isolated graph suite: 37 passed, including definition-only/run artifact
  parity and disclosure tests.
- Fast gate, native Clippy, application TypeScript/Vite build and generated
  contract check passed. Vite retains its bundle-size advisory.
- IPC registration and settings contract UI regressions: 40 passed. The Windows
  sandbox initially prevented esbuild from reading an ancestor directory; the
  same tests passed with approved elevated execution.
- Full native library suite: 890 passed, 6 failed, 6 ignored. This run preceded
  the final definition-only export and raw-ID TypeScript annotations; the final
  37-test graph suite, Clippy and application build cover those final changes.
- Documentation entry-point links and whitespace checks passed.

The six native failures reproduce the prior checkpoint: five conversation
activation tests (`defaults_schedule_reply_coaching_and_assessment_without_backfill`,
`late_assessment_shares_pending_work_preserves_source_and_credits_once`,
`late_helpers_bind_current_access_and_reject_unavailable_sources`,
`opening_failed_help_is_a_read_and_retry_is_explicit`, and
`requesting_reading_before_reply_does_not_schedule_other_helpers`) and the storage
migration test
`baseline_upgrade_preserves_history_settings_and_has_a_recovery_copy`.
They concern automatic reading scheduling, current model metadata and migrated
versus fresh defaults. No policy assertions were weakened to obtain a pass.
The full application suite is not green; workflow reconstruction remains gated.

Contract generation also exposed a committed source/generated mismatch:
native `DEFAULT_EXECUTION.reading` is `automatic`, while the previous generated
TypeScript said `on_demand`. Regeneration now reflects `automatic`. This can affect
UI defaults and is distinct from the graph inspection implementation; the native
policy was not changed here. The settings contract regressions passed with this
alignment. Migration/default-policy consistency remains unresolved as above.

No live provider calls, production graph ownership, workspace migration, IPC
wiring or activity renderer were exercised or introduced by this checkpoint.
