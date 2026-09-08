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
  Settings fold beside the composer; reply ideas expand inside practice cards. Persona controls fit in one row; the pencil opens character details.
  Voice works in *and* out.
  Partner prompts require an easy question, choice, or concrete invitation to
  respond on every turn, within the selected difficulty and lesson context.
  Lesson leads with a jewel-toned map and seven branch selectors above the skill cards. On phones, expand the map to browse its domains. Click a card
  for a practice explanation and example; double-click for reviewed replies and
  XP attribution. Recent message reviews and lesson details expand on request.
  On mobile, tapping a word shows its gloss without leaving Chat; tapping the
  surrounding partner message opens Analysis.
- **Skill tree** — your language profile, meaning-domain practice paths and inspectable progress.

Choose the language you are learning from the **Learning** dropdown at the upper right beside your language profile. On Guided conversation, **My native language** is also available at the bottom. Both save automatically and switch to the conversations for that language pair. Changing the learning language resets its regional variety to the default; use Settings to choose another variety. The selectors support desktop and mobile layouts.

Supported languages are symmetric: English (US), French, Spanish, Arabic, and
Chinese (Mandarin) can each be the language you're learning or your own
language, with regional dialect selection where applicable. The canonical
registry is `src-tauri/src/languages.rs`.

Lesson choices open in a centered, dismissible editor and save automatically as you type. Closing waits for pending changes to save; errors keep the editor and unsaved text open. The coach conversation has a distinct background beneath the lesson and analysis.

Each chat saves its character description and first introduction. Reopening restores that partner; editing or deleting persona templates affects future chats only. The persona pencil shows the saved snapshot separately from the template library. Older chats recover their earliest saved introduction, with the unknown original template clearly labeled.

Choose **No persona** or switch personas **Off** for conversation without a fictional character. Switch **On** to use Surprise me, or reroll to choose a different partner. Changing these controls starts a new conversation and preserves the previous chat.

The **Coach** button shares the settings row above the input. It opens preloaded advice for the latest partner message: translation, a brief explanation, and two suggested replies with their meanings. Non-Latin phrases include romanization; each phrase has expandable approximate phonetic pronunciation. Selecting a reply adds only its target-language text to the draft without sending. Advice is generated with the background suggestion pass, not when the button is clicked. The bounded tray scrolls without covering the conversation. The private coach chat remains in the lesson panel.

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

**Pre-alpha:** SkellySpeak is a new project in active development. You’re welcome
to try it, but expect things to break. Hosted login is limited to known parties
at this time. Use the hosted login or enter your own OpenRouter and Groq API keys
(G-R-O-Q, not G-R-O-K) in Settings.

For installers, use the [download page](https://docs.freemocap.org/skellyspeak/download).
It detects your operating system, lets you select or correct the processor,
and recommends a matching installer from the latest published GitHub release.
The page uses FreeMoCap’s compact download rows, with other platforms and system help collapsed below.
Revisit the download page on an Android phone to download the APK. iPhone testing
is limited to known parties at this time and uses TestFlight invitations.

```powershell
cd skellyspeak
npm install
npm run tauri dev     # first run compiles the Rust core (~2-5 min)
```

For macOS Computer Use, keep that dev session running and run
`npm run macos:dev-bundle` after compilation finishes. Run one app process; see
[macOS development setup](skellyspeak-docs/docs/platforms.md) for consistent signing
and avoiding repeated Keychain approvals.
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

## Conversation and practice

The practice board starts with the saved or recommended focus and two core skills
with less recorded XP. **All areas** offers one skill per domain; **List/Grid** is a
saved layout preference. Browsing a card or map arm selects that skill across the
application without changing saved focus. A card expands in place; its explicit
detail action or double-click opens the explanation and reviewed replies.

The seven-domain map heads the lesson panel, with branch selectors and star progress. It starts expanded on desktop and collapsed on phones; its toggle can collapse it to a slim row on either layout. Lesson/Analysis tabs sit above the map. Cards follow directly below it; a small card display menu holds All areas and List/Grid. The selected skill moves to the first card, with other cards retaining their relative order. Its arms
show progress toward unassisted milestones; XP includes assisted practice too.
Domain colors identify the same areas in cards, message evidence and Skills.
Selection is a neutral outline. On phones, lesson content follows the conversation
through separate Chat and Lesson views. Chat keeps its messages scrolling above the input and the optional coach-help tray, so help does not overlay the latest exchange. Long messages may still require scrolling. Reply ideas are available directly above the input as well as in lesson cards. The permanent XP/focus strip is removed; the profile button opens progress on demand. Headers compact further when typing on a short mobile viewport.
Coach Enter sends, Shift+Enter adds a newline, and composition Enter does not send.

Explanations load only when disclosed. The card and detail share an
in-flight request and bounded cache, scoped to settings/language pair, chat, level
and topic. Retry refreshes every mounted subscriber. These are general skill hints,
not claims about the latest sentence. Reply ideas, frames and starters come from
the partner reply's analysis; they are general conversation options. Inserting help
appends to the current draft and records assistance without sending automatically.

Word help offers its gloss and an explicit **Explain this word** action. Credited
words also offer **XP details**. Punctuation can reveal a sentence translation;
each message has its own full-translation button once that data arrives. Learner
translations begin hidden; partner auto-translation can be collapsed locally.
**Analysis** is a separate message action. On phones it opens a dismissible message dialog over the conversation; Close, tapping outside, Escape, or Back returns to the same chat position. Desktop analysis stays in the learning panel. Audio and translation controls do not
navigate. Learner and partner token reveals have separate identities.

Credited phrases carry domain-colored underlines. Overlapping domains share an
underline; repeated wording is marked at each possible occurrence and explained as
ambiguous. XP details retain all quotes for a skill with one stored-credit total.
New-credit badges show only the net increase: an assisted-to-direct replacement can
show +8 while the record has 10 XP. Animations use visible anchors inside the active
conversation, account for clipping, and stop moving when the layout scrolls or
resizes. Reduced motion uses a static badge. History never replays as new rewards.

Feedback, XP and skill details use the same dialog host; word help uses the same
layer lifecycle. Outside click, Escape and the overlay back stack dismiss them.
Changing surfaces closes transient learner overlays. Understanding/grammar feedback
describes the message separately from skill XP. Editing retains a collapsible copy
of the original feedback until the edit is sent or cancelled.

**Preferences & coach memory** discloses lesson choices, observations and learner
memory. Changing topic keeps the conversation and gets new suggestions from the
new reply. **+** starts a separate chat while retaining the current one in history.
Record/Stop and Send stay in place during voice capture; Discard appears alongside.
Stop transcribes to the draft unless Auto-send voice is enabled.

## Skills and language profile

**My language profile** opens a summary of XP, stars and focus. **Skill tree** starts
with expandable domain cards. **Map** opens the graph with horizontal, radial and
top-down layouts, breadcrumbs, Back and Whole tree. Horizontal direction follows
the application. All skills, including extensions, are reachable from domain cards,
related skills and Inspect. A selection opens the shared detail beside the map or
cards; **Open full details** opens a dialog. Exploration keeps the conversation
mounted, preserving draft and position. Only **Practise this in conversation** saves
a new focus; **Follow recommendations** releases it.

The shared catalog covers entities/reference, properties/comparison,
events/participants, time/event structure, space/movement,
negation/questions/possibility and connections between ideas. New learner messages
receive independent background assessments through the existing provider routing.
Distinct successful wording earns 10 XP per skill without recorded in-app help,
or 2 XP with suggestions, scaffolds or revision. Three unassisted successes earn
a star. External assistance is unknown. These milestones are not certified
proficiency and never change conversation difficulty.

Only current saved source versions and current-catalog judgments contribute.
Editing, deleting, truncating or excluding attempts recomputes totals. Excluded,
superseded, pending, failed and historical evidence remains explicitly classified;
it cannot display current credit through a different UI filter. Source records,
exclusion/restore controls, assessment activity and old-rubric evidence remain
available through disclosure. Progress is separate per target language and shared
across native-language contexts. Browser Skills uses clearly labeled sample data;
the native app does not substitute sample data on a failed load.

Skill assessment prompts require native-language explanations of the quoted
construction, linguistic function and specific criterion. A topic paraphrase is
insufficient. Existing saved explanations are not rewritten. Semantic calibration
across languages and uncertain-phrase coaching markers remain separate planned
work; missing XP is never treated as proof of a mistake.

## Personas and voice

Persona backstory guides manner and stays mostly unspoken. Built-in sketches
include formative books; existing chats retain their saved sketch. Prompts ask for
natural conversational openings within the current difficulty and lesson choices,
and distinguish partner identity from learner identity. These instructions do not
guarantee every generated reply's quality.

Saved personas have stable cloud voice casts. Custom personas are cast by ID;
explicit age, gender and manner guide delivery. **Cloud voice without a persona**
applies only to no-persona chats. OS voices are selected by target language and
stable identity; their metadata does not reliably describe age or gender. Audio
cache ownership includes settings scope, language pair, chat, requested voice and
text. Changing settings or leaving conversation cancels current playback.

## AI inspection

The **AI** panel exposes the live execution graph, recorded and running calls,
timing, models and responses. Prompts, attempts and provenance are available through
the request reader. **How it works** provides context; **Debug** discloses controls,
logs and comparisons. Reply streaming and independently hydrated analysis, skill
review and coach work retain their existing Rust owners. Topic explanations are
tracked requests; cloud speech uses its specialized audio path and playback status,
not identical Runner telemetry.

## Factory reset

Settings → **Clear all data…** requires typing `DELETE` and choosing **Erase all data
and close**. Reopening completes removal of local conversations, lesson/coach
memory, evidence, progress, settings, credentials, app-managed logs/caches and
webview preferences. **Reset settings** only resets preferences. Cloud accounts,
billing/usage records and external exports remain. Factory reset cannot be undone.

The conversation partner continues the existing exchange after its opening, without repeating greetings or introductions on ordinary replies or practice preference changes.

New XP flags pop above visible credited wording, shrink into the visible matching map arm, and briefly brighten that arm on arrival. With the map collapsed, flags fade at the phrase; offscreen evidence is announced without an invented animation origin. Reduced motion keeps the flag stationary.

Inline activity indicators distinguish reply generation, pending reply analysis, skill review, and voice transcription. Analysis stays marked while its data is pending even after reply streaming finishes. Transcription is indicated beside the composer and disables a second recording until it completes. The large, red-outlined **Record** button fills red and reads **Stop** while recording. The same compact indicators are used on phones; reduced motion retains labels without spinning.

Credited phrases have skill-colored +N superscripts. Clicking one opens its XP card and pops away the marker for the mounted conversation; it does not award XP again. The card grows from its evidence into a floating position at the top of the conversation, above the composer. Selecting another score opens it while the previous card departs. Tapping outside, Close, Escape, or Back sends the card into its visible skill arm, which flashes on arrival. A compact skill indicator provides a visible destination when the map is collapsed or offscreen. Reduced motion switches states without travel. Clicking the underlined phrase opens its saved XP explanation directly. Uncredited word taps retain their gloss; credited words retain word help through long press. Active reply, analysis, and transcription status also appears beside the composer so it stays visible when the relevant message is scrolled away.

Tagged iOS releases automatically upload their verified IPA to App Store Connect once upload credentials are configured. Internal TestFlight groups can distribute processed builds automatically; external beta review is separate. See [TestFlight setup](skellyspeak-docs/docs/platforms.md#automatic-testflight-uploads).

The Coach tray’s refresh button requests different advice using the previous advice and recent conversation as context. Existing advice stays visible while loading; a successful refresh replaces and saves it. Opening the tray still makes no request.

The composer header shows a compact summary of language, level, topic, voice/reading toggles, and playback speed on the left. Click the summary to expand settings; its left disclosure arrow shows whether they are open. Coach sits on the right with its own disclosure arrow. Small Translate and Analysis buttons follow the message text inline. An active persona appears after the language as “Persona: name”; no persona entry appears when disabled. The summary stays within two lines, with full setting names and a horizontally scrollable status line on narrow screens. Persona controls remain inside the expandable settings; a pencil opens persona details and the Custom persona option opens the editor. Persona choices label current and new conversations in parentheses.
