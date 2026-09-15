# Persona generation native lifecycle — 2026-09-12

Native A04 lifecycle and durable receipt wiring are implemented. The root agent owns the schema/receipt module, AI activity views and final integrated verification.

Implemented in `generation.rs` and `lib.rs`:

- Native begin/run/cancel commands replace the monolithic generation command. Begin captures request authority and returns a generation ID before provider work; run is single-use.
- Registry ownership is limited to four pending/running generations. Pending tickets expire after 30 seconds; begin/run prune expired tickets before admission. Cancel removes pending tickets and promptly wakes active credential/provider awaits. Run cleanup frees the slot on every return/drop.
- Begin refuses paused execution with actionable AdmissionHeld guidance. Run rechecks pause, config revision, route, active credential, target URL/model and holds before/after credential access, every 100ms while awaiting the provider, and before proposal adoption.
- Cancellation/authority loss after the submission boundary is UnknownOutcome, with no automatic retry. Before submission it prevents provider dispatch. A ready late result cannot defeat cancellation.
- Provider refusals are recorded against the captured target and returned unchanged. A newly recorded self-hold cannot replace the original provider error; a separate hold interrupting submitted work produces UnknownOutcome.
- Existing generation identity/parser tests remain intact.

Receipt functions now run at expiry, begin, cancel, dispatch and finish. Store-before-Registry lock ordering serializes begin/cancel/claim/dispatch. Failed begin receipts release volatile ownership. The dispatch receipt is committed before network polling; cancellation never races past that boundary without a corresponding unknown outcome. Completion metadata remains available even after parse/authority failure. Final validation and terminal receipt share the Store lock, and receipt failure never returns a proposal. Briefs/proposals remain volatile.

Verification: `cargo test --manifest-path src-tauri/Cargo.toml --lib generation` passed 17 tests at integration handoff. New native helper tests cover failed durable begin cleanup, idempotent cancellation, cancellation/authority loss before adoption, malformed proposal usage retention and terminal write failure refusing adoption. Lifecycle tests use temporary stores, synthetic futures and refusal values; no paid or external provider calls. Full native/contract/diagnostic integration checks remain with the root agent.

Independent integration review checked receipt schema/state transitions, additive upgrade boundaries, global/language versus persona ownership, partial/unknown usage and terminal write gating. Two followups were identified: non-stop model completions must not become successful proposals, and repeated late metadata must not overwrite already-known receipt values (root owns the latter correction).

The non-stop guard is implemented; its regression covers length, content-filter, tool-call and empty finish reasons with otherwise valid persona JSON, retaining reported usage in failed receipts. An additional refusal→hold→failed receipt→restart→explicit recovery regression confirms the refusal and hold survive reopening, no implicit replay occurs and recovery merely permits a new pending request. The generation-filter run passed 24 tests after these additions.


## Final integration — authorized schema12

The receipt table, 11 → 12 upgrade, all lifecycle hooks, global/language usage and
read-only generation activity UI are now integrated. Root receipt tests cover
metadata privacy, cancellation and late callbacks, rejected-proposal token retention,
restart recovery without replay, bounded views with full totals, atomic write
failure and refusal holds across restart/explicit recovery. Native command tests
cover failed registration cleanup, authority-gated terminal publication and
non-stop provider finishes. The final integrated suite passed 516 frontend tests
and 257 native tests, plus strict Clippy, formatting, contracts and builds.
Earlier pending statements in this handoff describe its intermediate checkpoint;
see audit-fixes-2026-09-12.md for final status.
