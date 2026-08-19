# ADR-0004: skellysubs-core library crate + TDD

**Status:** Accepted

**Decision:** Put pure domain logic in a `skellysubs-core` library crate (a
workspace member), unit-tested headlessly. `src-tauri` is the thin app layer
and depends on it via a path dependency.

**Rationale:** Fast unit-test cycles without Tauri/UI deps; clean separation of
"logic" from "side effects"; matches the spec-driven/TDD way of working.

**Consequences:** Workspace manifest at the app root; two crates; one lockfile.
