<p align="center">
  <img src="public/skellyspeak-logo.png" alt="SkellySpeak" width="180" />
</p>

# SkellySpeak

A standalone, no-necessary-login, multilingual language tutor. Tauri v2 — desktop
(Windows/macOS/Linux), Android, and iOS (built & signed in CI).

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

Release Android builds are made by CI, signed with the upload keystore. A
local `tauri android build` produces an unsigned release, which installs
nowhere — use the debug loop above for development.

## iOS

iOS cannot be built on Windows — Tauri's `ios` subcommand only exists on
macOS, and Xcode does the signing. `.github/workflows/ios-distribute.yml` runs
on a macOS runner: it scaffolds the Xcode project, signs with an Apple
Distribution certificate + provisioning profile, and exports a signed `.ipa`
for TestFlight or ad hoc install. Voice input works on iOS through the same
core (cpal) recorder as desktop — see
[Platforms & Build](./skellyspeak-docs/docs/platforms.md) for the AVAudioSession
detail and the three secrets to set.

## Updates

Desktop builds check for a newer version on launch and offer it in a bar at
the top of the window; Settings → Updates checks on demand. The feed is
`latest.json` on the newest **published** GitHub release, so publishing a
draft is what pushes it to existing installs.

Android and iOS cannot install updates in place — the OS package manager owns
that — so there the check offers to open the release and you install the
package yourself.

Building installers locally works without the updater signing key, but the
updater artifacts are then skipped — and `tauri build` reports that as an
error while still exiting 0. To produce a full, updatable bundle:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content ~/.tauri/skellyspeak.key -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "<key password>"
npm run tauri build
```

## Cutting a release

`src-tauri/Cargo.toml` is the only place the version lives — everything else
inherits it.

```powershell
node scripts/release.mjs minor --dry-run   # see the plan, change nothing
node scripts/release.mjs minor             # bump, commit, tag, push
```

Takes `patch`, `minor`, `major`, or an explicit version like `1.0.0-rc.1`.
It refuses before touching anything if the tree is dirty, the branch is not
`main`, the remote is ahead, the version would go backwards, or the tag already
exists — and after tagging it checks that the tag really does contain the bump,
because a tag naming the wrong commit is the one failure that has to be undone
on the remote.

The tag triggers `.github/workflows/release.yml` (desktop + Android) and
`.github/workflows/ios-distribute.yml` (iOS), which together build Windows x64,
macOS (Apple Silicon + Intel), Linux (x86_64 + aarch64), an Android APK/AAB and
a signed iOS `.ipa`, and attach them all to a **draft** GitHub Release. Review
the assets, then publish.

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
- `src-tauri/src/commands/` — the IPC surface, 32 commands in one module per
  domain: `guided` (a turn and the passes behind it), `coach`, `conversations`,
  `app_settings`, `hosted_auth`, `stories`, `scaffolds`, `insight`, `tts`,
  `stt`, `keys`, `dev`
- `src-tauri/src/conversation.rs` — where conversations live on disk, one
  directory per language pairing
- `src/pages/GuidedPage.tsx`, `src/pages/StoriesPage.tsx` — the two surfaces

## Hosted service numbers

```bash
cd server && uv run python stats.py
```

Who signed up, spend per day, devices. Or click the [Firestore console](https://console.cloud.google.com/firestore/databases/-default-/data?project=skellyspeak-api).
Details: [Hosted API](./skellyspeak-docs/docs/hosted-api.md).

## Docs

Full documentation lives in [`skellyspeak-docs/`](./skellyspeak-docs) (Docusaurus):

- [Overview](./skellyspeak-docs/docs/overview.md) — what SkellySpeak is, the steer row, the agent architecture
- [Architecture](./skellyspeak-docs/docs/architecture.md) — IPC surface, turn pipeline, prompt composition
- [Ontology](./skellyspeak-docs/docs/ontology.md) — every domain entity, field-by-field
- [Status](./skellyspeak-docs/docs/status.md) — what works, known issues, order of battle
- [The Coach](./skellyspeak-docs/docs/coach.md) — the private side-channel tutor (the Cyrano principle)
- [Platforms & Build](./skellyspeak-docs/docs/platforms.md) — desktop + Android + iOS build matrix
- [Future Work](./skellyspeak-docs/docs/future-work.md) — replacing per-turn LLM glossing with dictionaries
- [Hosted API](./skellyspeak-docs/docs/hosted-api.md) — sign-in, quota, deploying, and reading the usage numbers

```powershell
cd skellyspeak-docs && npm install && npm start   # preview the docs site
```
