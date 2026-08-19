# SkellySubs v2 → Design Document

**Status:** Living draft (iterating, not final)
**Working title:** SkellySubs v2 · a cross-language conversation partner
**Goal:** A desktop app where you **speak** (in whatever natural mix of languages comes out) and get a **word-aligned transcript** plus a **mixed-language partner reply**, for language learning and communication across language boundaries. Built as a **Tauri v2 app in pure Rust**, standing on Handy's open-source machinery. Video subtitling is retained as a secondary mode on the same engine.

---

## 1. Product vision (the reshaping)

This is **not** primarily a video subtitler anymore. It's a **back-and-forth, transcripted, word-aligned chat window** → a conversation partner.

The core insight that drives the design: real bilingual people **code-switch constantly**. "How do you say *grandmother* in Arabic?" is said *in English*, with one Arabic word in the middle. The reply comes back *also* mixed → some Arabic, some English, with grammar/vocab help folded in.

So the product is:

1. **Push-to-talk** → hold a key, speak, release.
2. **Live transcription** of what you actually said (mixed languages, not sanitized).
3. **Word-aligned bilingual display** → the word you just said is highlighted next to its match in the other language, in real time. *(This is the SkellySubs word-matching concept, moved from burned video frames into a live chat.)*
4. **A partner reply** from an LLM tutor → mixed shared+target language, answering "how do I say X" / "why is the grammar Y" / "here's how a native would say it."
5. **Video subtitling as a secondary mode** → same transcription + translation + word-match engine, exported to SRT/VTT/ASS or burned in.

### MVP scope (chat-first)

- Fixed **language pair** per session (shared language + target language). *(Default; see open questions.)*
- Push-to-talk → VAD-trimmed utterance → streaming transcription → language-ID → translation + word-match → aligned display → LLM tutor reply.
- **Out of scope for MVP:** TTS (later), video mode UI (later), multi-target-languages-at-once, speaker diarization.

---

## 2. We build ON Handy — pull the machinery straight from it

Handy (`cjpais/Handy`) is **MIT-licensed** and explicitly designed to be forked: *"Handy isn't trying to be the best speech-to-text app→it's trying to be the most forkable one."* Its README is explicit that **name/logo/brand are NOT open-source** → we use our own branding.

**Strategy: VENDOR Handy's capture / transcription / model machinery straight into our app. We do NOT reimplement any of it.** Handy's `src-tauri` is the foundation: fork/vendor its modules, strip the dictation-specific parts (hotkeys, paste, clipboard, tray, overlay, global-shortcut), and keep everything that listens to the mic, transcribes, and manages models.

### Pull straight from Handy (vendor/fork — do not reimplement)

| Concern | Pull from Handy |
|---|---|
| Audio capture + VAD | `managers/audio.rs`, `vad-rs` (Silero), `cpal`, `audio_toolkit/` |
| Transcription | `transcription_coordinator.rs`, `managers/transcription.rs`, `transcribe-rs` (ONNX) + `transcribe-cpp` (GGML) |
| Model manager | `managers/model.rs` + `model/download.rs`, `model_capabilities.rs`, `gguf_meta.rs`, `hf-hub` |
| LLM client | `llm_client.rs` (reqwest + JSON-schema, OpenAI-compatible) |
| Type-safe bridge | `specta` / `tauri-specta` |
| Frontend stack | React + TS + Tailwind + Zustand + i18next |
| Mobile gating | `capabilities/` + `gen/` + `swift/` + `cfg(target_os)` |

### We author (SkellySubs-specific — Handy has none of this)

- Translation prompts + word-matching (the `python-only` IP) — already in `skellysubs-core`
- Tutor conversation layer (mixed-language partner replies)
- Subtitle formatters (SRT/VTT/ASS/MD) — already in `skellysubs-core`
- Word-aligned chat transcript UI
- 78-language config — already in `skellysubs-core`

---

## 3. Key decisions (confirmed)

| Decision | Choice |
|---|---|
| Language | **Pure Rust** (no Python sidecar) |
| Shell | **Tauri v2** (desktop now; Android/iOS later) |
| Input | **Push-to-talk** (simpler) |
| Transcription | **transcribe-rs (ONNX, Parakeet) + transcribe-cpp (GGML, Whisper)** → Handy's runtime split |
| LLM | **Minimal `reqwest` + JSON-schema** client, OpenAI-compatible (Ollama / LM Studio / OpenAI / OpenRouter) → tutor role, not just translator |
| Model distribution | **First-run download** from HuggingFace (`hf-hub`), cached in app-data, swappable |
| Code-switching | **Language-ID routing + glossary bias** (see §5.3) → the #1 research spike |
| Preview/display | Webview chat DOM overlay; no per-frame burn |

---

## 4. Architecture overview

```
┌──────────────────────────── Tauri v2 App ─────────────────────────────┐
│  Webview (React + TS + Tailwind + Zustand, specta-typed commands)      │
│    • push-to-talk UI + status                                          │
│    • word-aligned bilingual chat transcript (live highlight)           │
│    • partner reply bubbles · settings (language pair, model, provider) │
│  ─────────────────────────── invoke / events ────────────────────────── │
│  Rust core (src-tauri)                                                  │
│    • audio        — capture (cpal) + VAD (vad-rs/Silero)               │
│    • transcription— transcribe-rs + transcribe-cpp drivers (streaming) │
│    • language_id  — whatlang/isolang (code-switch detection)           │
│    • translation  — 3 prompts (full/segment/word-match) + alignment    │
│    • tutor        — reqwest JSON-schema LLM (mixed-language replies)   │
│    • models       — hf-hub model manager (download/cache/swap)         │
│    • subtitles    — SRT/VTT/ASS/MD formatters (video mode)             │
│    • media        — ffmpeg sidecar (video mode)                        │
│    • languages    — 78-language config                                  │
└────────────────────────────────────────────────────────────────────────┘
```

**Flow (per turn):** hold key → capture PCM → VAD trim → streaming ASR (word timestamps) → language-ID per span → translate + word-match → emit aligned transcript event → LLM tutor reply → display.

---

## 5. Component design

### 5.1 Audio capture + VAD (Handy's machinery)
- `cpal` (capture) + `vad-rs` (Silero VAD) to trim silence and mark turn boundaries.
- Push-to-talk: record while key held; on release, finalize the utterance.
- Output: **16 kHz mono f32 PCM**, which both `transcribe-rs` and `transcribe-cpp` consume natively.

### 5.2 Transcription (streaming, word-timestamped)
- **Parakeet** via `transcribe-rs` (ONNX) → Handy's choice for modern CPU/GPU models. **Whisper** via `transcribe-cpp` (GGML) → multilingual fallback.
- **Word timestamps are non-negotiable** (they feed the aligned display). `transcribe-cpp` gives token-level timing with `word_index` (verified against source); **`transcribe-rs`' timestamp granularity must be confirmed in the spike.**
- Models (Q8_0 GGUF unless noted): `parakeet-tdt-0.6b-v2` (English, 730MB), `parakeet-tdt-0.6b-v3` (25 EU langs), `parakeet-unified-en-0.6b` (streaming), Whisper `large-v3` (multilingual, auto-detect). Parakeet is English-only except v3; **Whisper is the multilingual/code-switch workhorse.**

### 5.3 Code-switching (the new hard problem) — *spike item*
You speak English with Arabic sprinkled in; a native speaker replies in Arabic. Options to evaluate:
1. **Multilingual ASR** (Whisper large-v3 handles mixed-language audio + auto-detect).
2. **Language-ID routing** → `whatlang`/`isolang` (Handy already uses them) detects the dominant language per span/turn and routes to the right model.
3. **Glossary/prompt bias** → supply a per-session "words you may hear in the target language" list to the ASR (generalizing the original `TRANSCRIBE_BASE_PROMPT` idea).

The spike decides the MVP mix; likely: Whisper (multilingual) for the shared side + a per-session glossary, with language-ID as a routing hint.

### 5.4 Translation + word matching (the SkellySubs IP, repurposed)
The three `python-only` prompts, kept **verbatim**, now run **per turn** (not per video):
1. **Full-text translation** of the utterance.
2. **Segment-level translation** with context.
3. **Word-level matching** → align each spoken word to its closest word in the target language (many-to-one). This drives the **live highlight** in the chat.

Also generalized: the same alignment can align the **partner's mixed-language reply** against a canonical translation, so *both* sides of the conversation are word-aligned.

### 5.5 LLM tutor (minimal client, conversation role)
- Plain `reqwest` + `serde` + `schemars`, targeting `POST /v1/chat/completions` with `response_format: {type:"json_schema", ...}`.
- Providers: **Ollama (local), LM Studio, OpenAI, OpenRouter** → any OpenAI-compatible endpoint; provider + model configurable.
- **Role:** a language tutor/partner → mixed-language replies, "how do I say X," grammar/vocab help, natural reformulation. The 3-stage translation is a *tool* this layer uses, not the whole product.
- Handy's `llm_client.rs` (multi-provider reasoning-disable handling) is the reference pattern.

### 5.6 Word-aligned chat display (frontend)
- Two-column / interleaved view: original text with the currently-highlighted word, matched to the target-language word, live.
- RTL (Arabic) via proper bidi; romanization shown under non-Latin scripts.
- The old `video-subtitle-viewer` components become the seed for this UI.

### 5.7 Video/subtitle mode (secondary, later)
- Same engine; add ffmpeg sidecar for audio extraction + ASS burn; reuse SRT/VTT/MD formatters (ported to Rust).

### 5.8 Model manager (first-run download, swappable)
- `hf-hub` (cancellable) + a `ModelManager` mirroring Handy's `managers/model` + `model_capabilities` + `gguf_meta`: list → download → verify → cache → select.

### 5.9 Language config
- One canonical 78-language JSON asset (from `old/skellysubs-ui/src/language_configs.json`), loaded by Rust, single source of truth.

---

## 6. Data model (serde, specta-typed)

```
struct Utterance { pcm: Vec<f32>, language_pair: LanguagePair }
struct Transcript { text, language, segments, words: Vec<WordTimestamp> }   // ms timestamps
struct Alignment { original_word_index, translated_word_index, ... }         // per-language
struct Turn { transcript, translation: TranslatedText, alignment, tutor_reply }
struct Conversation { language_pair, turns: Vec<Turn> }
```

Normalization (from the old audit): store a **language key**, never a full config, per word.

---

## 7. Frontend plan

- React + TS + Vite + Tailwind 4 + Zustand; **specta** generates `bindings.ts` for typed commands.
- Reuse/repurpose the old `skellysubs-ui` stage components where they fit; the chat/transcript view is new.
- Responsive (mobile later); RTL + romanization handled in the display layer.

---

## 8. Project layout

```
(app)/                        # created by create-tauri-app
├── src/                      # frontend (React/TS)
├── src-tauri/                # Rust backend
│   └── src/
│       ├── commands/         # Tauri commands
│       ├── audio/            # capture + VAD
│       ├── transcription/    # transcribe-rs + transcribe-cpp drivers
│       ├── language_id/      # whatlang/isolang routing
│       ├── translation/      # prompts + word-match
│       ├── tutor/            # LLM client + conversation
│       ├── models_mgr/       # hf-hub model manager
│       ├── subtitles/        # SRT/VTT/ASS/MD
│       ├── languages/        # config loader
│       └── models/           # serde types
└── assets/                   # language_configs.json, fonts
```

---

## 9. Dependencies (minimal, Handy-aligned)

**Rust:** `tauri` v2, `serde`/`serde_json`, `schemars`, `reqwest`, `tokio`, `thiserror`/`anyhow`, `tracing`, `transcribe-rs` (onnx), `transcribe-cpp`, `vad-rs`, `hf-hub`, `whatlang`/`isolang`, `cpal`, `specta`/`tauri-specta`.
**Frontend:** React 18, TypeScript, Vite, Tailwind 4, Zustand, `@tauri-apps/api`, specta bindings.
**Sidecars:** ffmpeg (video mode only).

---

## 10. Phased roadmap (MVP-first)

- **Phase 0 → Spike (de-risk the two unknowns).**
  1. `transcribe-rs` (ONNX Parakeet) word-timestamp granularity.
  2. Code-switch handling: Whisper multilingual vs language-ID routing vs glossary bias.
  *(Runs on your machine → this sandbox can't `cargo build` or run Ollama; see §11.)*

- **Phase 1 → Turn pipeline (no UI).**
  Push-to-talk capture → VAD → ASR → language-ID → translate + word-match → tutor reply. Headless, unit-tested against `old/sample_data`.

- **Phase 2 → Tauri shell + chat UI.**
  specta command bridge, push-to-talk UI, word-aligned chat transcript, tutor reply bubbles.

- **Phase 3 → Model manager + polish.**
  First-run model download/swap UI; RTL/romanization; settings (pair, provider, model).

- **Phase 4 → Mobile + video mode.**
  Android build; video subtitling as a secondary mode; TTS (future).

---

## 11. Build-environment notes (verified)

- Toolchain here: Rust 1.95/cargo, cmake, clang, ffmpeg 6.1, node 22, git.
- `git` reaches GitHub + HuggingFace; **cargo cannot fetch crates.io in this sandbox** (schannel TLS). So I author code here; **you build/run on your machine**.
- Ollama is not installed here; the LLM/tutor spike needs your machine.

---

## 12. Open questions (iterate here)

1. **Language pairing** → default fixed pair per session (recommended). Open: multiple targets, or free-form?
2. **Code-switch approach** → settle via Phase-0 spike (§5.3).
3. **`transcribe-rs` timestamps** → confirm word-level output (§5.2).
4. **App name / identifier** → "SkellySubs v2" is a working title; rebrand TBD.
5. **TTS later** → out of MVP, revisit after chat is solid.

---

## 13. Research summary (sources)

- **Handy** → MIT, Tauri v2.11 + React/TS/Tailwind/Zustand + specta; "most forkable": [github.com/cjpais/Handy](https://github.com/cjpais/Handy), [handy.computer/docs](https://handy.computer/docs).
- **transcribe-rs** (ONNX → Parakeet/Moonshine/Canary/Cohere) and **transcribe-cpp** (GGML → Whisper): Handy's runtime split, both published crates.
- **Parakeet** → [nvidia/parakeet-tdt-0.6b-v2/v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v2), [unified-en-0.6b](https://huggingface.co/nvidia/parakeet-unified-en-0.6b); GGUF ports under [handy-computer](https://huggingface.co/handy-computer).
- **Model manager** → `hf-hub` ([cjpais/hf-hub](https://github.com/cjpais/hf-hub)) + Handy's `managers/model`.
- **LLM client** → Handy's `llm_client.rs` (reqwest + JSON-schema, OpenAI-compatible).