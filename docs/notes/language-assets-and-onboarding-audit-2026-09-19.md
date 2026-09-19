# Language assets, installation size and first-run setup

Status: audit and proposals recorded 2026-09-19. The language picker direction was
subsequently accepted; see [implementation and review](add-languages-2026-09-19.md).
Android packaging is explicitly deferred. Onboarding follows a separate UX/UI
design pass after the language-selection flow is settled.
Source snapshot: `103b9593` (v2.0.5). Latest published release returned by GitHub
was v2.0.4; v2.0.5 exists as a Git tag but had no release to inspect.
All MB/KB below are decimal bytes, not MiB/KiB.

## Findings

**Language additions are currently cheap. Android architecture packaging is the
largest measured opportunity. Downloadable script fonts would improve consistent
rendering and prevent future growth, rather than remove a large existing payload.**

| Source asset | Measured size | Interpretation |
| --- | ---: | --- |
| 12 language YAMLs | 33,978 bytes | About 2.8 KB per language on average |
| All runtime content selected by native/build.rs | 71,698 bytes | Excludes schemas and Markdown; includes those language YAMLs |
| Bibliography additionally embedded by build.rs | 44,351 bytes | Shared provenance, not a per-language model |
| 9 shared TTF font files | 1,434,280 bytes | IBM Plex Sans 400/500/600/700, Plex Mono 400/500/600, Newsreader 400/500 |
| Fonts including licenses and README | 1,447,898 bytes | All local, same shared fonts regardless of chosen language |
| 7 interface translation JSONs | 449,935 bytes | Eagerly imported; distinct from learning-language YAMLs |
| Native icon sources | 942,839 bytes | Source total, not an estimate of each platform's bundled icon cost |

Source totals are not compressed installer contributions. Frontend resources can
be embedded inside the native binary. Removing one raw source byte need not save
one installer byte, especially across multiple architectures.

The current font README explicitly documents system fallback for missing glyphs.
There are no bundled per-language Noto packs. Arabic, Mandarin, Hindi and Malayalam
rely on platform coverage. New Latin-script languages reuse the same shared fonts.
No bundled speech-recognition, synthesis or language-model weights were found in
active packaging; speech uses provider transports. Downloading fonts would not
make conversation generation or speech inference offline. Audio caching is a
separate runtime concern (currently an in-memory cache capped at 16 MiB).

The fonts are TTF, one file per declared weight, with no CSS unicode-range split.
A WOFF2/variable-font experiment is worthwhile, but savings and glyph coverage
must be measured before replacing files. Do not subset to the current example
sentences: arbitrary user messages, combining marks and transliteration need
coverage. Indic shaping tables and language-specific CJK forms must survive.

### Published download sizes

Measured using GitHub release asset metadata:

| Artifact | v1.21.2 MB | v2.0.4 MB | Change MB |
| --- | ---: | ---: | ---: |
| Android universal APK | 91.23 | 103.05 | +11.82 |
| Android AAB | 34.34 | 39.86 | +5.52 |
| macOS arm64 DMG | 9.92 | 11.93 | +2.01 |
| Windows x64 setup EXE | 7.32 | 8.99 | +1.67 |
| Linux x64 AppImage | 89.66 | 91.71 | +2.06 |
| Linux x64 DEB | 13.10 | 15.40 | +2.30 |
| iOS IPA | 8.24 | 9.57 | +1.33 |

These are download sizes, not measured installed footprints or App Store/Play
optimized device downloads. Releases differ in much more than language count;
the table does not establish a causal growth rate per language.

Downloaded and inspected the published v2.0.4 universal APK ZIP directory:

| Entry | Bytes (both stored and uncompressed) |
| --- | ---: |
| lib/x86/libskellyspeak_core.so | 27,300,852 |
| lib/arm64-v8a/libskellyspeak_core.so | 26,703,512 |
| lib/x86_64/libskellyspeak_core.so | 26,597,328 |
| lib/armeabi-v7a/libskellyspeak_core.so | 19,701,024 |
| Total native libraries | 100,302,716 |
| Whole APK | 103,050,520 |

The four libraries occupy 97.3% of the APK. Their contents include more than
machine code; this audit has not attributed sections within the libraries.
Keeping only the existing arm64 library would remove 73.6 MB of library payload
and suggests an approximately 29.5 MB APK before rebuild, alignment and signing
differences. This is an arithmetic estimate, not a built artifact.

Recommendation: retain a universal fallback and offer labeled per-architecture
APKs, prioritizing arm64. For Play delivery, the existing AAB is the right input:
Play generates optimized APKs containing the device's needed code/resources.
An AAB is not itself a smaller sideload installer. [@android_app_bundle_2026]
Inspect AppImage contents separately before attributing its fixed overhead;
its large size relative to DEB does not implicate languages.

## Current user flow

- `LearningPicker` exposes the entire catalog, with a separate **Browse languages**
  button. `LanguageBrowser` already provides search, variety selection, linguistic
  review status, examples and an explicit selection action.
- Selecting a target language saves settings and selects/creates its conversation.
  Merely browsing does not mutate preferences.
- Explanation language and interface locale are independent. A target-only font
  policy would miss explanation text, interface text and older conversations.
- No personal enabled-language list, asset download manager or resource removal
  flow exists.
- `Preferences.onboarding` has not-started/completed/skipped states, initialized
  to not-started. Source search found no UI onboarding flow consuming it.
- Fresh learner preferences use English explanations/interface. `prepare_chat`
  starts Spanish when no active contact exists. First-run language choice needs
  to precede that default chat creation, rather than adding a wizard on top of it.

Key owners: `ui/src/features/settings/language/LanguagePickers.tsx`,
`ui/src/features/languages/LanguageBrowser.tsx`, `ui/src/app/AppShell.tsx`,
`native/src/storage/store/startup.rs`, `native/src/model.rs`,
`ui/src/styles/foundations/tokens.css`, `native/build.rs`,
`native/tauri.conf.json`, `.github/workflows/release.yml`.

## Options

| Option | Benefits | Costs and limits |
| --- | --- | --- |
| A. Keep system fonts; add a personal language list | Small scope, no downloads, no extra font payload | Rendering varies across devices; adding a language does not guarantee good glyph coverage |
| B. Small bundled core plus on-demand script fonts | Consistent tested rendering for selected languages, shared downloads, bounded initial size | Requires lifecycle, offline/error UI and upstream maintenance |
| C. Bundle every supported script font | Predictable first use without font downloads | Installer grows as script coverage expands; most users carry unused assets |

**Recommended direction: B, staged behind A's language-selection experience.**
Keep YAMLs and all current interface dictionaries local. Keep core interface fonts
bundled so the setup screen never depends on a successful download. Optimize those
shared fonts independently. Do not introduce a generalized downloadable lesson,
voice or model marketplace for this work.

### Ownership and visible behavior

Keep these concepts independent:

1. **Catalog:** all supported languages/varieties, authored and shipped with the app.
2. **My languages:** the learner's chosen shortcuts, not a deletion boundary.
3. **Downloaded assets:** device-local shared resources with explicit versions.

The primary picker lists My languages plus **Add language…**. That action opens
the existing browser. A row/detail shows **Ready**, **Download required**, or
**Download failed**, with actual additional bytes when the resource manifest is
known. Display a localized name alongside the endonym so the picker remains usable
before that script's font is installed. Browsing alone starts no download.

Proposed sequence: choose language → choose variety → see required download and
size → **Add language** (or **Download and add**) → progress/cancel/retry → ready.
Adding need not switch the active conversation; provide **Use now** explicitly.
This avoids current selection side effects during onboarding and browsing.

Resolve font dependencies by script/family/coverage and role, not one ZIP per
language. Hindi and a future Marathi entry could share Devanagari assets;
Portuguese varieties should not duplicate fonts. Resolve regional CJK glyph forms
explicitly instead of treating all Han text as one interchangeable font.
Consider target, explanation and interface selections together. Latin-font coverage
must be tested rather than assuming every Latin-script language needs zero bytes.

**Remove from My languages** only removes a shortcut. Conversations, partners,
progress and YAMLs remain. **Manage downloads** separately shows actual reclaimable
bytes and shared dependencies. Keep assets needed by selected languages and retained
conversation rendering by default; allow an explicit removal with a clear account
of what will require re-downloading. Do not silently evict fonts needed offline.

A failed required download leaves the previous language usable and does not mark
the new language ready. If a system-font mode is supported, make it an explicit,
tested option with its limitations visible, not silent fallback after an error.
Saved text remains available even when an asset needs repair. Downloaded fonts work
offline; inference still follows the existing AI access requirements.

## Downloading without our own hosting

This is feasible. Noto publishes per-script repositories and per-family releases,
and the Google Fonts repository provides font sources/binaries. Noto releases
include font ZIPs; CJK uses a separate repository. [@noto_distribution_2026]

Prefer an app-bundled, reviewed manifest of exact upstream files, versions or commit
paths, byte lengths, SHA-256 hashes, license notices and coverage. Use upstream
versioned files directly where available. Pin individual files rather than fetching
an entire all-weights family ZIP when possible. A small font-resource catalog can
remain local alongside language metadata without hosting a service ourselves.

A mutable Google Fonts CSS request is convenient for websites but is a weaker fit
for durable app installs: file selection/versions are outside our release manifest,
and browser cache alone is not an installation record. Fontsource is another
candidate distribution source with subset packaging, but introduces another
maintainer/CDN; using subset imports at build time still bundles the files.
[@fontsource_subsets_2026]

No owned hosting does not mean no maintenance: upstream URLs may disappear or be
unreachable. A hash mismatch must fail; never accept replacement bytes because the
URL is familiar. A broken pinned URL may require an app update. Source IP/download
requests reach the upstream host; no account, credentials or conversation text
should be sent with asset requests. Custom optimized packs would require some
place to distribute our derivatives, so direct upstream binaries trade some size
control for simpler operations.

Tentative implementation, after agreeing the user behavior:

- Native owns bounded downloads, HTTPS/redirect allowlisting, expected size/hash,
  temporary files, atomic installation, cancellation and interrupted-run recovery.
- Use app-owned persistent asset storage, separate from learner content and disposable
  web caches; no global OS font installation. Share identical assets on this device.
- UI gets state/progress and local font resources through a narrow integration.
  Current CSP only allows local resources and IPC; dynamic local font serving needs
  a scoped Tauri resource path/protocol and appropriate font CSP configuration.
  Do not broadly enable remote CSS or filesystem access. [@tauri_assets_2026]
- Load installed fonts before committing ready state. Validate mixed scripts,
  combining marks, RTL, shaping, annotations, line heights and font weights on
  Android/iOS/desktop WebViews. Font presence or a successful fetch alone is not
  proof of correct rendering.
- Preserve good installed versions during failed updates; clean only unreferenced
  versions after successful installation. App updates and workspace reset must have
  explicit resource retention rules.

## First-run setup and optional tutorial

Recommendation: a short setup followed by dismissible guidance during real use.
Do not lead with a long carousel or a tour of every feature. This respects the
current voice/chat-first direction and does not reopen lesson/progression design.

1. **Languages:** choose interface language and explanation language, then one
   learning language/variety. Interface options remain limited to existing translated
   locales; adding a learning language does not imply translated app chrome.
   Show a readable text sample and download requirements together. More languages
   can be added later through the same browser.
2. **AI access:** reuse the existing supported access choices and validation controls.
   Explain what is required before a live conversation. Allow **Set up later** and
   browsing without pretending generation works. Do not create a new account model.
3. **Start a conversation:** use existing topic/partner controls. Offer voice first
   and typing alongside it; request microphone permission only when the learner
   chooses to record. A denial leaves typing available with a clear recovery route.

Then introduce assistance in context: after the first partner reply, point out
word help and playback; when the learner needs a reply, explain reply help; after
a real learner turn, explain the coach panel. Each hint can be dismissed; **Show
help again** is available from settings. Avoid automatic paid AI work merely to
advance a tutorial. If an offline example tour is later desired, mark it as demo
content and keep it out of conversations, credit and learner evidence.

Persist setup progress independently of download state and optional tutorial
progress. Resume an interrupted setup without repeating completed choices. Reuse
existing onboarding status where appropriate, extending it deliberately rather
than treating not-started as proof the person is a new user: existing installations
may already have that value. Existing conversations/preferences should suppress
mandatory first-run setup and offer optional help instead. No data migration layer
is proposed here; this is launch behavior for the current product.

Accessibility checks: keyboard/screen-reader focus, progress announcements, no
color-only download status, reduced motion, mobile control sizes and language
samples at the learner's chosen reading scale.

## Proposed sequence and discussion points

1. **Packaging baseline:** measure per-platform installed footprints; build an arm64
   APK; inspect native sections and AppImage composition; compare compressed fonts.
   Add per-release size reporting with separate download/installed/source numbers.
2. **Language selection:** My languages and Add language using existing browser,
   independent from font ownership. Preserve current language and history.
3. **One downloadable script pilot:** choose a script with observed rendering issues;
   curate upstream files and exercise offline/cancel/retry/corruption/restart paths.
   Compare rendering across supported platforms before extending the catalog.
4. **First-run setup:** reuse those controls, then add a small contextual tutorial.
   Verify fresh install, existing learner, skipped setup and permission-denied paths.

Decisions for discussion: whether consistent bundled/downloaded fonts are mandatory
per supported script or an optional enhancement; whether Add also switches language
(recommend explicit Use now); whether onboarding requires AI setup before entering
chat (recommend defer with a clear unavailable state). No code implementation or
release changes are included in this audit.

## Verification and limits

Read active source, packaging workflows and current design guidance; counted raw
files; queried published release metadata; inspected the downloaded APK archive.
No native rebuild, cross-platform visual check, installed-footprint measurement or
upstream font download pilot was performed. No app tests were needed for this
notes-only change. The temporary APK is under `/tmp/skellyspeak-size-audit-v204/`.
Untracked legacy `src-tauri/` build artifacts were not treated as shipped resources
and were left untouched. No commit, push, version bump or deployment performed.

Release evidence: [v2.0.4](https://github.com/freemocap/skellyspeak/releases/tag/v2.0.4)
and [v1.21.2](https://github.com/freemocap/skellyspeak/releases/tag/v1.21.2).
