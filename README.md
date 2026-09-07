<p align="center">
  <img src="public/skellyspeak-logo.png" alt="SkellySpeak" width="180" />
</p>

# SkellySpeak

A standalone multilingual language tutor that does not require an account.
Tauri v2 targets
desktop (Windows/macOS/Linux), Android, and iOS, with release workflows for each.

Two surfaces:

- **Guided conversation** — the conversation. A streamed tutor reply you can interrogate
  word by word (tap for a gloss, hold for a run, double-click for a full
  lemma/POS/usage card — on your own messages too), message-level **Coach feedback** badges with scores, corrections and editing,
  a **Lesson** panel showing your goal, preferences and coaching observations,
  and an **Analysis** tab for detailed breakdowns. Talk to the coach below the
  lesson: explicit requests update it; suggestions wait for you to apply them.
  Settings fold beside the composer; reply ideas expand inside practice cards. Persona controls fit in one row; the gear opens character details.
  Voice works in *and* out.
  Partner prompts require an easy question, choice, or concrete invitation to
  respond on every turn, within the selected difficulty and lesson context.
  Lesson leads with stable skill cards and a compact jewel-toned map at the upper-left edge of the lesson panel, in its own row above the controls. Expand the map to browse its seven domains. Click a card
  for a practice explanation and example; double-click for reviewed replies and
  XP attribution. Recent message reviews and lesson details expand on request.
  On mobile, tapping a word shows its gloss without leaving Chat; tapping the
  surrounding partner message opens Analysis.
- **Skill tree** — your language profile, meaning-domain practice paths and inspectable progress.

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
│  output, corrective retries)  ├─ Skill tree (meaning domains,
├─ Observer (reasoning model,   │   profile, evidence and progress)
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
  guided practice prompts (ported from the FreeLingo prompt library)
- `src-tauri/src/languages.rs` — supported languages + per-variant overlays
- `src-tauri/src/observer.rs` — the TeachingPlan / Profile documents and the
  background observer pass that rewrites them
- `src-tauri/src/commands/` — the IPC surface, with one module per
  domain: `guided` (a turn and the passes behind it), `coach`, `conversations`,
  `app_settings`, `hosted_auth`, `skills`, `scaffolds`, `insight`, `tts`,
  `stt`, `keys`, `dev`
- `src-tauri/src/conversation.rs` — where conversations live on disk, one
  directory per language pairing
- `src/pages/GuidedPage.tsx`, `src/pages/SkillsPage.tsx` — the two surfaces

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

Reply ideas, frames and starters live inside expanded practice cards. Choosing one inserts it into the draft, preserving existing text and recording assistance; it does not send automatically.

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

The lesson panel starts with practice cards, followed by the goal or suggested lesson topics, each
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

## Skill tree and language profile

**Guided conversation** and **Skill tree** are the two top-level tabs. Open
**My language profile** above the conversation to see the current target's XP,
stars, focus and evidence. Stories and its dedicated generation machinery have
been retired; any old browser story cache is left untouched but is no longer read.

The shared tree organizes concrete meaning relationships: entities/reference,
properties/comparison, events/participants, time/event structure, space/movement,
negation/questions/possibility, and connections between ideas. It compares the
functions languages express without requiring the same grammatical constructions.
The map shows three levels: experience, meaning domains, and core skills.
Extension skills remain accessible through their parent’s details and saved focus.
Selecting a branch smoothly zooms toward it; Back restores the previous viewport,
and Whole tree, breadcrumbs and a minimap keep navigation grounded. Closing
details leaves the viewport unchanged. Horizontal layout follows application
direction; radial/top-down views and an optional mobile list are available.

New guided learner turns receive a background worker assessment, using the normal
provider route and metering. Exact quotes, outcomes, recorded assistance and
request provenance are inspectable. Unobserved skills are not failures.
One/two successes earn checks; three earn a star. Distinct successful wording earns
10 XP per skill without recorded in-app assistance, or 2 assisted practice XP.
Assisted practice does not advance stars; external assistance is unknown.
These are practice milestones, not certified proficiency.

**Practise this in conversation** saves a focus and returns to chat. It steers
subsequent partner, suggestion, feedback and lesson-planning requests, subject to
your explicit lesson choices and difficulty. **Follow recommendations** releases
a pinned focus. Progress never changes conversation difficulty. The local learner
has separate progress for each target language, shared across native-language
contexts. Profile switching is not implemented.

Only current saved source versions and current-catalog judgments contribute.
Duplicate wording counts once per skill. Editing, deleting, truncating or excluding
an attempt recomputes totals. Previous rubric judgments stay inspectable but earn
no new-skill credit. Historical conversations are not automatically re-evaluated.
Browser-only mode uses labeled sample data; the native app never substitutes it
for a failed load. The evaluator still needs cross-language semantic calibration.

See [Meaning Domains & Skill Progression](skellyspeak-docs/docs/skill-progression-design.md).

### Factory reset

Settings → **Clear all data…** opens a destructive-action confirmation. Type
`DELETE` and choose **Erase all data and close**. Reopen SkellySpeak to complete
the reset. It removes local conversations, lesson/coach memory, skill evidence
and progress, settings, saved credentials, app-managed logs/caches and webview
storage (including layout preferences). **Reset settings** only restores preferences.
Cloud accounts, billing/usage records and exports saved outside app storage remain.
The reset cannot be undone.

The practice board initially shows the focus skill and two areas with less recorded
practice. All areas shows one card per domain. Selecting a card or map arm shares
the selected skill with Skills without changing saved practice focus. Selecting an
area outside the suggested set exposes it. List/Grid remains a saved preference.
Cards and the full map use the same domain palette, neutral selection, skill overview
and evidence records. Explore actions carry the skill into the map; returning to
conversation preserves its mounted draft and history. The XP strip opens a progress
summary before the explicit Explore skills action.

On phones, lesson content follows chat in one scroll, with a demand-loaded selected
hint by the composer. Navigation jumps to Chat or Lesson; AI is separate. Word
inspection has keyboard access; Analysis is an explicit message action. Learner
and partner reveal states are independent. Shared detail dialogs support outside
click, Escape and the overlay back stack. Native keyboard/layout validation remains
pending.

Newly completed skill reviews show a short XP animation labeled with the credited
phrase and skill. Existing history loads without replaying rewards. The chat
header is compact; Settings & voice starts folded for new users while preserving
saved disclosure preferences.

Credited phrases in learner replies are underlined in their domain color. Tap for the recorded reason and message-level skill XP. The map reserves space above lesson controls; selecting an arm expands its skill card.

Skill assessment instructions require explanations in the learner’s native language that identify the quoted construction, its linguistic function, and its relationship to the specific rubric. Topic summaries alone do not support credit. Prompt version `skill-evidence-5` applies to new assessments; saved explanations are not rewritten. Map selection uses a neutral outline independent of domain colors.

XP flights and phrase details share a domain-colored reward badge with the skill, credited XP and source phrase. Selecting a highlighted phrase opens that badge with its explanation; outside click or Escape closes it without awarding XP again.

Speech uses the saved conversation persona. Built-in characters have distinct cloud voice casts; custom characters receive a stable cast by ID. Explicit age, gender and manner in the saved character guide cloud delivery, without inferring gender from occupation. No-persona chats use the configured voice. OS playback selects a stable installed voice per persona within the target language; OS voices expose no reliable age/gender metadata. Audio caching separates chats.

Coach chat sends with Enter; Shift+Enter inserts a newline, and IME composition Enter does not send. Partner prompts treat persona details as optional background and require contextually natural invitations, rather than preference questions mechanically built from incidental words.

Persona backstory stays mostly unspoken. Built-in sketches include formative books and the outlook each character takes from them; the editor encourages the same approach. These details guide manner, not recurring topics, quotations or imitation. Existing chats retain their saved sketches; revised built-ins apply to new chats.

Both chat bubbles offer a compact full-message translation control when their translation arrives. Learner translations stay hidden until requested; partner auto-translation remains an explicit setting. Tokenizer instructions map each gloss to its source token independently, allowing multiword glosses rather than aligning translated sentence positions.
