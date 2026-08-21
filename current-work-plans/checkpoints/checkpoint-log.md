# Checkpoint Log

| # | Date | What was run | Result | Notes |
|---|---|---|---|---|
| 0 | (scaffold) | `pnpm tauri dev` | PASS | Stock Tauri v2 + React 19 app |
| 1 | r3 | `cargo test -p skellysubs-core` | **PASS** | 32 tests (models, prompts, subtitles, languages) |
| 2 | r4 | `cargo test -p skellysubs-core` | **PASS** | 36 tests (llm types + orchestrator) |
| 3 | r5 | `cargo test -p skellysubs-core` | **PASS** | 39 tests (reqwest client) |
| 4 | r6 | `cargo run -p skellysubs-core --example llm_smoke` | **PASS** | local end-to-end: LM Studio + gemma-4-e4b |
| 5 | r9 | `cargo check -p skellysubs` | **PASS** | Handy machinery vendored + compiles |
| 6 | r10 | `cargo check` + `cargo test transcription_adapter` | **PASS** | transcribe_detailed (word timestamps) + adapter |
| 7 | r11 | `cargo test -p skellysubs-core` | **PASS** | 42 tests (tutor layer + TutorReply) |
| 8 | r12 | `cargo test -p skellysubs-core` + `pnpm tauri dev` | **PASS** | 53 tests (grammar IR/analyzer/cards/learner/turn) + split-screen UI |
| 9 | r13 | `pnpm tauri dev` | **PASS** | copy-all button + preterite + ser/estar fallbacks (55 tests) |
| 10 | r14 | `cargo test -p skellysubs-core` + `cargo check -p skellysubs` | **PASS** | 58 tests (sheltering: super7 seed → known_vocab in tutor prompt) |
| 11 | r15 | `cargo check -p skellysubs` + `pnpm tauri dev` | **PASS** | voice slice: PTT capture + Whisper Small + transcribe → tutor |
| 12 | r16 | `pnpm tauri dev` | **pending** | QA polish: VAD silence gating (Offline) + idempotent PTT stop |
| 13 | r17 | `cargo test -p skellysubs-core` + `cargo check -p skellysubs` + `pnpm tauri dev` | **pending** | provider config UI (LLM + STT local/remote, OpenAI/Anthropic) |
| 14 | r18 | `cargo check -p skellysubs` + `pnpm tauri dev` | **pending** | STT model → Nemotron Streaming 3.5 (recommended multilingual) |
| 15 | r19 | `cargo test -p skellysubs-core` + `cargo check -p skellysubs` + `pnpm tauri dev` | **pending** | OpenRouter default (shared key, LLM + STT remote preset) |
| 16 | r20 | `cargo test -p skellysubs-core` + `pnpm tauri dev` | **pending** | LLM structured output → json_object + prompt schema (OpenAI rejects schemars schema) |
| 17 | r21 | `cargo test -p skellysubs-core` + `cargo check -p skellysubs` + `pnpm tauri dev` | **pending** | DeepSeek default + streaming tutor reply |
| 18 | r22 | `cargo test -p skellysubs-core` + `cargo check -p skellysubs` + `pnpm tauri dev` | **pending** | forced tool-use structured output (OpenAI + Anthropic) + graceful degradation |
| 19 | r23 | `cargo test -p skellysubs-core` + `cargo check -p skellysubs` + `pnpm tauri dev` | **pending** | conversation memory + humanized grammar panel + stronger tutor prompt |
| 20 | r24 | `cargo test -p skellysubs-core` + `cargo check -p skellysubs` + `pnpm tauri dev` | **pending** | fix streaming double-listener; suggested replies; color-coded grammar |
| 21 | r25 | `cargo check -p skellysubs` + `pnpm tauri dev` | **pending** | run analysis + suggestions LLM calls concurrently |

## Commands

```powershell
cd skellysubs
cargo test -p skellysubs-core
cargo check -p skellysubs
pnpm tauri dev
```
