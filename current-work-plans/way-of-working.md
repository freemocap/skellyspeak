# Way of Working

## Spec-driven development

1. Every feature/component starts as a **spec doc** in `docs/specs/` with:
   - Purpose, scope, inputs → outputs, behavior, **acceptance criteria**, out-of-scope.
   - A **test plan** (unit + integration + e2e).
2. Specs are written **before** implementation and kept updated as we learn.
3. Any disagreement between code and spec: fix the spec first, then the code.

## Test-driven development (TDD)

- Red → Green → Refactor.
- Write the failing test first, then the minimal implementation.
- Unit tests live in the same module via `#[cfg(test)] mod tests`.
- Pure domain logic goes in the `skellysubs-core` lib crate (fast, headless tests).
- Tauri commands + side effects go in `src-tauri` (integration tests).

## Checkpoint cadence

- I **pause at key intervals** and ask Jon to run:
  - `cargo test` (unit/integration)
  - `pnpm tauri dev` (app builds + runs)
  - e2e when present
- Each run is logged in `docs/checkpoints/checkpoint-log.md` with date + result.
- Do not move past a red checkpoint.

## Notes & design

- Working notes + spike results go in `docs/notes/`.
- Keep `DESIGN.md` (overview) and `docs/` (detail) in sync as decisions land.
