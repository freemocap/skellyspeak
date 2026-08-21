# SkellySubs v2 → Integrated Plan (Habla·ES direction)

**Status:** current working plan, MVP-first.
**One-liner:** a local-first AI language tutor — you chat (type now, voice soon) with a
**sheltered** partner, see a **word-by-word gloss**, and get **contextual grammar explanations**.
Spanish first, then Mandarin, then Levantine Arabic.

## ✅ Status (current)

**Working end-to-end (all green, 58 tests):**
- Chat round-trip: type → tutor reply (mixed Spanish/English, corrects + explains).
- Word-by-word gloss (interlinear Spanish = English).
- New-words (i+1) detection.
- Grammar breakdown: IR (`FeatureEvent`) + LLM Spanish analyzer + 6 mechanics cards,
  with deterministic fallbacks for preterite (`Tense=Past`) and ser/estar.
- **Sheltering**: Super-7 vocab seeds `LearnerModel`; the known list is injected into the
  tutor prompt so replies stay in-bounds (i+1 gating).
- Copy-all → clean markdown of the whole session + mechanics.

**Working — voice input (PTT → Nemotron Streaming 3.5 → tutor, live):**
- Managers constructed + managed in `setup()`; Silero VAD model vendored + bundled (`silero_vad_v4.onnx`).
- PTT commands: `start_listening` / `stop_listening` (capture → `transcribe` → text → tutor).
- Model commands: `stt_status` / `ensure_stt_model` → Nemotron Streaming 3.5 (751MB) — Handy's recommended multilingual model (28 langs, auto language detection).
- Silence gating via Handy's offline VAD (silent hold → no turn); idempotent PTT stop (no spurious error).

**Working — provider config (OpenRouter default, LLM + STT, persisted):**
- `ProviderSettings` (LLM + STT each: mode/format/baseUrl/apiKey/model) persisted via tauri-plugin-store.
- Default = OpenRouter remote for BOTH (one shared API key): LLM `anthropic/claude-sonnet-4.5`, STT `openai/whisper-large-v3-turbo`.
- Streaming: tutor reply streams token-by-token (`tutor-stream-delta` events) via SSE; grammar breakdown follows.
- Structured output: enforced via forced tool-use (OpenAI function-calling / Anthropic tool-use) + schema sanitization; analysis failure degrades gracefully (reply still shown).
- Conversation memory: prior turns are passed into the tutor prompt (it actually continues the conversation).
- Tutor prompt now corrects errors + explains grammar inline; grammar panel translates UD tags to plain English.
- LLM: remote OpenAI- or Anthropic-compatible (`LlmClient` enum); local = LM Studio.
- STT: remote OpenAI-compatible (`OpenAiSttClient`) or local (Nemotron Streaming 3.5).
- Settings UI: ⚙ → one shared OpenRouter key + per-service Local/Remote toggle (format/URL/model).

**Next (in order):**
1. Word timestamps on voice (swap `transcribe` → `transcribe_detailed` + adapter → `Transcription`) — note: `transcribe_detailed` is Whisper-only; Nemotron is non-Whisper, so this needs either a Whisper model or wiring transcribe-cpp's token timestamps.
2. Learner persistence (save to disk).
3. Assist slider.
4. Tutor prompt: decide mixed-language vs sheltered-Spanish-only (gloss is noisy on English tokens).
5. Mandarin, then Levantine Arabic.

---

## 0. The synthesis (what just merged)

We now have two things that snap together:

- **Ours (machinery, already built + compiling + tested):** Handy's STT/VAD/model stack
  (vendored), `skellysubs-core` (translation prompts, **word-matching**, tutor, subtitles,
  78-language config, minimal LLM client), `transcribe_detailed` + adapter for **word
  timestamps**.
- **The Notes (`notes/`):** a complete, **pedagogy-driven** product spec + a reference
  Tauri implementation ("Habla·ES"): **sheltering / i+1**, a **live grammar breakdown** via a
  language-agnostic **IR contract** (`FeatureEvent`), a **card engine**, a **learner model +
  SRS**, an **assist slider**, and a **split-screen UI** (chat + breakdown).

The key overlap: our **word-matching = the "interlinear gloss"** the Notes describe. And the
Notes' §9 explicitly says to *reuse skellysubs' word-level translation + ai-client strategy*.
So we keep our machinery and adopt the Notes' product + pedagogy + UI.

## 1. MVP → the smallest useful thing (build THIS first)

**Goal: `pnpm tauri dev` opens a chat window; you type a message; the tutor replies.**

Concrete:
1. A `send_message(text)` Tauri command calling `skellysubs_core::tutor::tutor_reply`
   (already built + tested) through the LLM client.
2. A minimal React chat UI (Composer + Chat bubbles), ported from
   `notes/spanish-tutor/src/components/`.
3. A provider setting (LM Studio `http://localhost:1234/v1` + `google/gemma-4-e4b` — already
   proven in our smoke test — or Ollama `gemma4:e4b`).

**Done when:** type "¿cómo se dice hello?" and get a mixed-language tutor reply back.

No STT, no grammar breakdown, no cards, no learner model yet. Just a working tutor chat.

## 2. Then add complexity (in this order)

1. **Word-gloss** — our word-match under each reply (tap a word → gloss + romanization).
2. **Voice input** — Handy's PTT capture + `transcribe_detailed` (already vendored) → speak, don't type.
3. **Grammar breakdown** — port the Notes' `FeatureEvent` IR + Spanish analyzer + cards +
   `MechanicsPanel` (split-screen UI).
4. **Sheltering** — the Notes' orchestrator i+1 gating (seed vocab: `notes/spanish-tutor/data/super7_es.json`).
5. **Learner model + SRS** — the Notes' `learner.rs` + spaced retrieval.
6. **Assist slider** — fade scaffolding in/out (the Notes' 4-stop design).
7. **Mandarin, then Levantine Arabic** — new analyzers (the pluggable-IR design makes this additive).

## 3. Reuse map (Notes → our codebase)

| Notes asset | Use it as |
|---|---|
| `notes/SPEC.md` | product + pedagogy spec; data contracts (§6); UI spec (§7) |
| `.../src-tauri/src/ir.rs` | `FeatureEvent` contract → port into `skellysubs-core` |
| `.../orchestrator.rs` | sheltering turn loop → port |
| `.../cards.rs` + `cards/spanish.json` | card engine + 6 seed cards |
| `.../learner.rs` | learner model + persistence |
| `.../analysis/spanish.rs` | Spanish analyzer (LLM + spaCy sidecar) |
| `.../llm/` | `LlmClient` trait (we have one; reconcile the two) |
| `notes/spanish-tutor/src/` (frontend) | Chat/Composer/MechanicsPanel → port into our UI |
| `notes/ui-assist-mockup.html` | the target split+assist-slider UI |

## 4. We already have (do NOT rebuild)

- Handy STT / VAD / model manager (vendored, compiling).
- `skellysubs-core`: translation + word-matching + tutor + subtitles + 78 langs + LLM client (41+ tests).
- `transcribe_detailed` + `transcription_adapter` (word timestamps → `Transcription`).
- The design tokens/pedagogy from `notes/SPEC.md` §2 + §7.1.

## 5. Immediate next steps (this week, in order)

1. Wire `send_message` command + provider config in `src-tauri`.
2. Port the minimal chat UI (Composer + Chat).
3. `pnpm tauri dev` → chat round-trip works.
4. Then word-gloss, then voice, then grammar breakdown.

## 6. Open decisions

- **Shell:** keep our `skellysubs/` app + lift the Notes' concepts in (recommended), vs. adopt
  `notes/spanish-tutor/` as the shell + bring in our STT.
- **Provider default:** LM Studio (`google/gemma-4-e4b`, proven) vs Ollama (`gemma4:e4b`).
- **Analyzer:** how soon to move Spanish off LLM-JSON onto a deterministic spaCy sidecar.
