<p align="center">
  <img src="public/skellyspeak-logo.png" alt="SkellySpeak" width="180" />
</p>

# SkellySpeak

A standalone multilingual language tutor that does not require an account.
Tauri v2 targets
desktop (Windows/macOS/Linux), Android, and iOS, with release workflows for each.

Two surfaces:

- **Guided** — the conversation. A streamed tutor reply you can interrogate
  word by word (tap for a gloss, hold for a run, double-click for a full
  lemma/POS/usage card — on your own messages too), message-level **Coach feedback** badges with scores, corrections and editing,
  a **Lesson** panel showing your goal, preferences and coaching observations,
  and an **Analysis** tab for detailed breakdowns. Talk to the coach below the
  lesson: explicit requests update it; suggestions wait for you to apply them.
  Suggestions and settings fold independently beneath compact headings attached to their respective content. Persona controls fit in one row; the gear opens character details.
  Voice works in *and* out.
- **Stories** — level-matched short stories (beginner / intermediate /
  advanced) with tap-to-translate word glosses.

Supported languages are symmetric: English (US), French, Spanish, Arabic, and
Chinese (Mandarin) can each be the language you're learning or your own
language, with regional dialect selection where applicable. The canonical
registry is `src-tauri/src/languages.rs`.

Lesson choices open in a centered, dismissible editor and save automatically as you type. Closing waits for pending changes to save; errors keep the editor and unsaved text open. The coach conversation has a distinct background beneath the lesson and analysis.

Each chat saves its character description and first introduction. Reopening restores that partner; editing or deleting persona templates affects future chats only. The persona gear shows the saved snapshot separately from the template library. Older chats recover their earliest saved introduction, with the unknown original template clearly labeled.

Choose **No persona** or switch personas **Off** for conversation without a fictional character. Switch **On** to use Surprise me, or reroll to choose a different partner. Changing these controls starts a new conversation and preserves the previous chat.

The coach conversation starts as a compact dock with its message box visible. Drag its top border to resize it, or use the heading toggle to collapse the thread while keeping the composer available. Its height and collapsed state persist on this device across reloads. The divider also supports the Up/Down arrow keys and Enter.

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

- **API keys** are stored in the platform credential vault and used only by the
  Rust core. The webview only ever receives them masked (`sk-or-••••••••cdef`),
  and a masked value round-tripping back means "keep the stored key".
- Structured output uses the native `json_schema` response format on every
  attempt, with corrective retries for malformed output and 429s. **There is
  no degraded fallback path** — anything else fails loudly with the
  provider's actual error, so a bad model gets replaced rather than papered
  over.
- Choose the hosted service with Google sign-in, your own provider keys, or your own AI server. Conversation files stay on the device.

## Run

```powershell
cd skellyspeak
npm install
npm run tauri dev     # first run compiles the Rust core (~2-5 min)
```

For macOS Computer Use, keep that dev session running and run
`npm run macos:dev-bundle` in another terminal after compilation finishes.
Open `src-tauri/target/debug/bundle/macos/SkellySpeak.app` to use the dev app
as a discoverable macOS bundle. See the [development bundle workflow](./skellyspeak-docs/docs/platforms.md#macos-development-bundle)
for hot reload and rebuild instructions.

On first launch, open Settings (⚙), choose the language you're learning and your
native language, then either sign into the hosted service, supply your own
OpenRouter/Groq keys, or configure an OpenAI-compatible chat server.

## Build an installer

```powershell
npm run tauri build   # platform bundles under src-tauri/target/release/bundle
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
for TestFlight or ad hoc install. Voice input is implemented through the same
core (cpal) recorder as desktop and requires physical-device verification — see
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
  structured output, bounded corrective retries, `$defs` inlining)
- `src-tauri/src/prompts/` — shared persona/mandatory-rules blocks,
  guided + story prompts (ported from the FreeLingo prompt library)
- `src-tauri/src/languages.rs` — supported languages + per-variant overlays
- `src-tauri/src/observer.rs` — the TeachingPlan / Profile documents and the
  background observer pass that rewrites them
- `src-tauri/src/commands/` — the IPC surface, with one module per
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

Collapsed Suggestions shows up to two compact reply badges (one on narrow screens). Tap a badge to send the full suggestion; expand the section for all replies, frames and starters.

The **AI** panel opens directly on the live pipeline. A compact strip shows recorded and running model calls; select a call or graph node for its timing, model, response preview, and expandable prompts and raw responses. **How it works** explains the context; **Debug** expands execution controls, logs and the advanced comparison workspace without replacing the main graph. Filter retained activity by chat and exchange. The full-height request reader shows captured inputs, every attempt, effective parameters and prompt-block comparisons. Traces survive restarts within local retention limits and can be exported for an audit; see [Observability](skellyspeak-docs/docs/observability.md).

Selected graph nodes have a labeled outline and highlighted connections, synchronized with the selected call. Execution states include text labels. Shared text colors and keyboard focus indicators support readable dark and light surfaces.

Mobile keeps the interactive graph with a readable starting zoom, pan/zoom controls and a navigation map. Node details open over the graph with a dedicated close control.

The voice composer keeps Record/Stop and Send in the same positions while recording. **Discard** appears to their left. Stop transcribes into the draft, or sends the transcription when **Auto-send voice** is enabled.

Use **+** in the conversation header to start a new chat directly; the previous conversation remains in history.

Reply instructions explicitly separate the partner's identity from the learner's.
The saved introduction is labeled as an assistant message; the partner is told
to use a learner name only after the learner identifies themselves. The AI
request reader exposes this as the `participants` prompt block. These are model
instructions, not a guarantee that every generated reply follows them.

The lesson panel leads with the actual goal or suggested practice topics, each
with a short explanation, target-language example and translation. Compact
**Try an example** and **Why this?** links prepare a coach question without
sending it. **Preferences & coach memory** groups correction settings,
preferences, observations, learner memory and change history behind one disclosure.
Topic notes load through a read-only model call at the selected practice level;
errors are shown with Retry. Notes are held while the topic view remains mounted.

When retrying a message, the original attempt's corrections and coach remark
stay available in a collapsible, scrollable reference above the composer,
including during voice recording. The conversation remains accessible and the
full feedback modal is still available. Sending or cancelling the edit removes
the reference.

## Proposed direction: a shared skill map

The [Skill Map & Progression design](skellyspeak-docs/docs/skill-progression-design.md) proposes one capability graph
across languages, learner-owned goals, inspectable evidence and playful progress
markers. It includes the research basis and staged implementation plan. Skill
levels, XP and profile switching are not implemented yet.
