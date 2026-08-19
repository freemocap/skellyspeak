# Testing Strategy

## Layers

| Layer | Where | Runner | Goal |
|---|---|---|---|
| Unit | `skellysubs-core` (`#[cfg(test)]`) | `cargo test -p skellysubs-core` | pure logic: models, prompts, word-match, subtitles, languages, llm client, model mgr |
| Integration | `src-tauri` | `cargo test` | Tauri commands, audio/VAD, transcription drivers, tutor wiring |
| E2E | Playwright + `tauri-driver` | `pnpm test:e2e` | full push-to-talk → transcript → reply flow |

## Conventions

- One test module per source module.
- Tests must be **deterministic** (no network, no timing flakiness). Networked pieces use a
  trait seam with an in-memory fake.
- Golden-file tests for prompts (assert exact template text + no unfilled placeholders)
  and for subtitle output.

## Coverage goal

- `skellysubs-core`: 100% of pure functions covered (target).
- `src-tauri`: happy path + error paths for each command.
- e2e: one full MVP conversation turn.
