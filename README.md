<p align="center">
  <img src="public/skellyspeak-logo.png" alt="SkellySpeak" width="180" />
</p>

# SkellySpeak

A standalone, no-necessary-login, multilingual language tutor. Tauri v2 — Windows
desktop and Android today.

Two surfaces:

- **Guided** — the conversation. A streamed tutor reply you can interrogate
  word by word (tap for a gloss, hold for a run, double-click for a full
  lemma/POS/usage card — on your own messages too), a **Coach** tab that
  privately grades and corrects what you wrote, an **Analysis** tab with
  explainer cards and reply scaffolds, a level/topic steer row, and voice
  in *and* out.
- **Stories** — level-matched short stories (beginner / intermediate /
  advanced) with tap-to-translate word glosses.

Four languages, symmetric: English, French, Spanish, Arabic — any of them as
the language you're learning, any of them as your own, with regional dialect
selection on top.

## Architecture

```
Rust core (src-tauri)           React 19 + Vite + TS frontend (src)
├─ OpenAI-compatible client     ├─ Guided conversation (streamed reply,
│  (OpenRouter; SSE streaming   │   then analysis + coach hydrating in
│  + json_schema structured     │   asynchronously, section by section)
│  output, corrective retries)  ├─ Stories reader (tokenized text,
├─ Observer (reasoning model,   │   tap-for-gloss popover, level chips)
│  rewrites plan + profile)     └─ Two-layer design: paper conversation /
├─ Coach (private side-channel)     dark analysis (Habla·ES tokens)
├─ Settings + document persistence
│  (JSON in the app config dir)
└─ Groq Whisper STT · OpenRouter TTS
```

- **API keys** are stored locally in the OS config dir and used only by the
  Rust core. The webview only ever receives them masked (`sk-or-••••••••cdef`),
  and a masked value round-tripping back means "keep the stored key".
- Structured output uses the native `json_schema` response format on every
  attempt, with corrective retries for malformed output and 429s. **There is
  no degraded fallback path** — anything else fails loudly with the
  provider's actual error, so a bad model gets replaced rather than papered
  over.
- No accounts, no server, no Docker. Everything is local except the AI calls.

## Run

```powershell
cd skellyspeak
npm install
npm run tauri dev     # first run compiles the Rust core (~2-5 min)
```

On first launch: open Settings (⚙) → paste your OpenRouter key (required) and
Groq key (only needed for voice input) → pick the language you're learning and
your native language.

## Build an installer

```powershell
npm run tauri build   # NSIS installer + portable exe under src-tauri/target/release/bundle
```

## Android

```powershell
npm run android       # emulator / connected-device dev loop
npm run android:apk   # sideloadable debug APK
```

See [Platforms & Build](./skellyspeak-docs/docs/platforms.md) for the toolchain
env vars and the machine-specific fixes that must survive a `gen/android`
regeneration.

## Layout

- `src-tauri/src/ai.rs` — provider client (streaming, schema-constrained
  structured output, fallback ladder, `$defs` inlining)
- `src-tauri/src/prompts.rs` — shared persona/mandatory-rules blocks,
  guided + story prompts (ported from the FreeLingo prompt library)
- `src-tauri/src/languages.rs` — supported languages + per-variant overlays
- `src-tauri/src/observer.rs` — the TeachingPlan / Profile documents and the
  background observer pass that rewrites them
- `src-tauri/src/commands.rs` — the IPC surface (14 commands): `guided_turn`,
  `coach_ask`, `generate_scaffolds`, `word_insight`, `speak_text`,
  `transcribe_audio`, `generate_story`, settings
- `src/pages/GuidedPage.tsx`, `src/pages/StoriesPage.tsx` — the two surfaces

## Docs

Full documentation lives in [`skellyspeak-docs/`](./skellyspeak-docs) (Docusaurus):

- [Overview](./skellyspeak-docs/docs/overview.md) — what SkellySpeak is, the steer row, the agent architecture
- [Architecture](./skellyspeak-docs/docs/architecture.md) — IPC surface, turn pipeline, prompt composition
- [Ontology](./skellyspeak-docs/docs/ontology.md) — every domain entity, field-by-field
- [Status](./skellyspeak-docs/docs/status.md) — what works, known issues, order of battle
- [The Coach](./skellyspeak-docs/docs/coach.md) — the private side-channel tutor (the Cyrano principle)
- [Platforms & Build](./skellyspeak-docs/docs/platforms.md) — Windows + Android today, iOS path
- [Future Work](./skellyspeak-docs/docs/future-work.md) — replacing per-turn LLM glossing with dictionaries

```powershell
cd skellyspeak-docs && npm install && npm start   # preview the docs site
```
