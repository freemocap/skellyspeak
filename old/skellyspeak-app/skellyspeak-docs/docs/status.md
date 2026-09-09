---
sidebar_position: 5
title: Status
---

# Current status

SkellySpeak is a working proof of concept. The source of truth for application
version is `src-tauri/Cargo.toml`; this page deliberately does not duplicate
the number.

## Implemented

- Guided, streamed conversation and the meaning-domain Skill tree.
- English, French, Spanish, Arabic, and Mandarin as symmetric target/native
  languages, including RTL, segmentation, dialect, and romanization metadata
  from `src-tauri/src/languages.rs`.
- Per-turn token glosses, translation, grammar mechanics, reply scaffolds, and
  private coach feedback.
- A persistent, interactive coach thread that the conversation partner never
  sees.
- Teaching-plan/profile memory updated by a non-overlapping background observer.
- Multiple resumable conversations per language pairing and custom personas.
- Hosted Google sign-in, bring-your-own OpenRouter/Groq keys, and custom
  OpenAI-compatible chat servers.
- Native credential storage, atomic JSON persistence, strict request routing,
  bounded retries, and surfaced errors.
- Microphone input, cloud or OS speech playback, playback-rate control, caching,
  and cancellation.
- Bounded local traces across restarts, per-attempt requests and effective
  parameters, reply/suggestion prompt blocks, request comparison and scoped export.
- A generated execution graph, reconciliation, and pause/resume/step controls.
- Topic explanations/examples and an edit-time reference to original coach feedback.
- Desktop update checks and CI workflows for desktop, Android, iOS, server, and
  documentation builds.

## Known limitations

- Tokenization, glossing, translation, and grammar analysis still use model
  calls. The planned local dictionary layer is described in
  [Future Work](./future-work).
- There is no vocabulary/SRS subsystem or dedicated first-run onboarding flow.
- Automated frontend tests mock the Tauri IPC boundary. There is no end-to-end
  suite driving a packaged app and the real Rust core.
- Native microphone, credential-vault, signing, installation, and update flows
  require platform/device verification. Desktop unit tests cannot establish
  those claims.
- Model traces contain prompt and output text and are intended for local
  diagnostics; they are not anonymized telemetry.
- Prompt editing/overrides and complete operation provenance remain proposed
  work; see [Observability](./observability).
- The Skill tree displays a local target-language profile with evidence-derived
  XP, checks/stars and saved practice focus. Previous rubric evidence remains
  inspectable without new-skill credit. The evaluator is not calibrated as a
  proficiency assessment. Browser mode uses labeled fixtures; profile switching
  remains future work. See the [progression design](./skill-progression-design).

## Verification

The maintained checks are defined in `.github/workflows/ci.yml`:

```powershell
npm test
npm run build

cd src-tauri
cargo clippy --lib -- -D warnings
cargo test --lib

cd ../server
uv run --frozen --group dev pytest -q

cd ../skellyspeak-docs
npm run build
```

Firestore-emulator, native-device, signing, and live-service checks are separate
because they need their corresponding environments.

## Planning

The live roadmap is generated from GitHub on the site's
[Roadmap](/skellyspeak/roadmap) page. Dated audit reports are historical
evidence, not the current backlog.
