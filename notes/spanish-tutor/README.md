# Spanish Tutor

A local, offline **comprehensible-input** Spanish tutor: you chat in Spanish with a
sheltered AI partner, and the app surfaces **contextual grammar cards** the moment a
mechanic (past tense, ser/estar, gender agreement…) shows up in the reply. Runs
entirely on your machine via **Gemma 4 E4B** through Ollama.

This is `01 Spanish` of the three-language build order. The whole pipeline sits behind
a language-agnostic IR contract, so Mandarin and Levantine slot in later as new
analyzers without touching the card engine, learner model, or UI.

## Architecture (one skeleton, pluggable analyzer)

```
Composer ─▶ send_message ─▶ orchestrator.run_turn
                                │
        sheltered prompt ◀──────┤   (LearnerModel: known vocab + level)
                                ▼
                       LlmClient (Ollama · gemma4:e4b)   ← conversation
                                ▼ reply
                       Analyzer (Spanish)                ← analysis
                                ▼
                       FeatureEvent  ◀── the IR contract
                                ▼
                       CardLibrary.trigger + LearnerModel
                                ▼
                    TurnResult → MechanicsPanel
```

- `src-tauri/src/ir.rs` — the `FeatureEvent` contract every analyzer emits.
- `src-tauri/src/llm/` — `LlmClient` trait + `OllamaClient` (swap for llama.cpp later).
- `src-tauri/src/analysis/spanish.rs` — Spanish analyzer. **LLM-based by default**;
  `SpacySidecarAnalyzer` is the stubbed production path.
- `src-tauri/src/orchestrator.rs` — the sheltered turn loop (i+1 vocab gating).
- `src-tauri/src/cards.rs` + `cards/spanish.json` — curated mechanics cards.
- `src-tauri/src/learner.rs` — known vocab, feature exposure, card recency (persisted).

## Prerequisites

1. **Rust** (stable) + **Node 18+**.
2. **Tauri v2 system deps** — see https://tauri.app/start/prerequisites/
3. **Ollama** running locally with Gemma 4 E4B pulled:
   ```bash
   ollama pull gemma4:e4b     # confirm the exact tag with: ollama list
   ollama serve               # usually already running on :11434
   ```
   If your tag differs, edit `MODEL_TAG` in `src-tauri/src/lib.rs`.

## Run

```bash
npm install
npm run tauri dev
```

Add app icons under `src-tauri/icons/` (Tauri's `icon.png` etc.) before a release build;
`npm run tauri dev` works without them.

## How sheltering works (the i+1 gate)

`orchestrator.rs` builds a system prompt tied to the learner's CEFR level and asks for
one new item per turn. After the reply, content-word lemmas not in `known_vocab` are
surfaced as **New words** and added to the known set. A stricter version would *regenerate*
replies that overshoot the level — left as a `TODO` so the scaffold stays snappy.

## Upgrading the analyzer (recommended next step)

The default Spanish analyzer asks Gemma for JSON morphology — quick, but the exact
freeform-LLM approach that can drift. To make grammar detection deterministic:

1. Bundle a Python sidecar (`tauri-plugin-shell`) running spaCy `es_core_news_md` or Stanza.
2. Have it read a sentence on stdin and print `FeatureEvent` JSON on stdout.
3. Fill in `SpacySidecarAnalyzer::analyze` and swap the `Arc<dyn Analyzer>` in `lib.rs`.

Nothing else changes — that's the point of the IR contract.

## Adding a language later

Implement `Analyzer` for `zh` / `ar`, drop a `cards/<lang>.json`, add a seed vocab file,
and route by target language. The Mandarin analyzer will lean on `constructions`
(particles like 了) more than `features`; Levantine will need dialect-aware tooling
(CAMeL Tools) plus an LLM-assist fallback.
