# Checkpoint Log

| # | Date | What was run | Result | Notes |
|---|---|---|---|---|
| 0 | (scaffold) | `pnpm tauri dev` | PASS | Stock Tauri v2 + React 19 app |
| 1 | round 3 | `cargo test -p skellysubs-core` | **PASS** | 28 unit + 4 golden = 32 tests |
| 2 | round 4 | `cargo test -p skellysubs-core` | **PASS** | 32 unit + 4 golden = 36 tests |
| 3 | round 5 | `cargo test -p skellysubs-core` | **PASS** | 35 unit + 4 golden = 39 tests (reqwest client) |
| 4 | round 6 | `cargo run -p skellysubs-core --example llm_smoke` | **PASS** | local end-to-end: LM Studio + gemma-4-e4b translate+word-match |
| 5 | round 9 | `cargo check -p skellysubs` | **PASS** | Handy machinery vendored + compiles |
| 6 | round 10 | `cargo check -p skellysubs` + `cargo test transcription_adapter` | **PASS** | transcribe_detailed (word timestamps) + adapter test |
| 7 | (pending) | `cargo test -p skellysubs-core` | — | tutor layer + TutorReply model |

## Commands

```powershell
cd skellysubs
cargo test -p skellysubs-core
cargo run -p skellysubs-core --example llm_smoke
cargo check -p skellysubs
```
