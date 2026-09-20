# Target-language reading audit — 2026-09-20

Status: source inspection and recommendations, not an implemented change or a
running-application verification. Requested scope: audit first. No application
behavior, schemas, content, dependencies or deployment changed.

## Requested behavior

Every displayed target-language occurrence should expose the same word-level
reading and inspection capabilities as the conversation, including suggestions,
coaching and configuration surfaces. Add a speaker action on selected token help
to read that token through the ElevenLabs text-to-speech route. This is distinct
from transcribing speech or replaying a recording.

## Findings

The application does not currently meet that consistency requirement. Reusing
the existing `TargetText` component alone will not fix it: that component passes
an empty token list and deliberately renders passive text. Saved annotations
are needed, and many surfaces only receive strings.

There is also no single complete main-chat interaction to copy unchanged.
`TurnView` chooses saved glosses, token-array rendering, or passive text. Those
paths expose different interactions. The common reading behavior should be
specified and consolidated before spreading any one path further.

### Existing reading mechanisms

- [SavedGlossText](../../ui/src/components/reading/SavedGlossText.tsx) uses exact
  UTF-16 source anchors, hover/click help, keyboard activation, a word-detail
  dialog, glosses, optional romanization/pronunciation and an Ask the coach action.
  Literal/unresolved spans and gaps remain passive. It does not request analysis.
  Script-sensitive groups retain whole-word shaping and individual part anchors.
- [TokenSpan](../../ui/src/components/reading/TokenSpan.tsx) provides token reveal
  and optional context-menu/hold callbacks. [TurnView](../../ui/src/features/conversation/messages/TurnView.tsx)
  adds drag reveal, bubble double-click and inspection routing on its token-array
  path. A supported callback is not necessarily wired by every caller; do not
  treat optional long-press support as universal current behavior.
- [TargetText / AnnotatedText](../../ui/src/components/reading/TargetText.tsx):
  `TargetText` is passive; `AnnotatedText` can reveal supplied token data, but its
  ordinary token path does not supply the richer inspection callbacks. Its
  shaping-sensitive path delegates to `SavedGlossText`.
- [Markdown](../../ui/src/components/reading/Markdown.tsx) uses passive
  `TargetText` for ordinary inline text. `[[term]]` buttons ask the coach about
  a term; they are not word glosses. Fenced blocks remain raw text.
- [AskCoachButton](../../ui/src/components/learning/AskCoachButton.tsx) disappears
  without an injected callback. The current callback provider is conversation
  scoped. Moving a renderer into Settings or Skills does not automatically give
  it coach access.

### Surface inventory

“Partial” below means some supplied annotations work, not full feature parity.
Mixed prose rows identify possible embedded target language; they do not imply
that every displayed string is in the target language.

| Surface and source owner | Current handling | Gap / required follow-up |
| --- | --- | --- |
| Main learner and partner messages — `features/conversation/messages/TurnView.tsx` | Partial: saved glosses, token arrays, or passive fallback; gloss status/retry UI | Establish one baseline across both sides and rendering paths; token speech absent; unresolved text cannot be inspected |
| Sentence analysis — `features/conversation/reading/AnalysisSentence.tsx` | Saved glosses or `AnnotatedText` | Same data-dependent and interaction differences as above |
| Suggested replies — `features/conversation/composer/ComposerHelp.tsx` | `SuggestedReply.segments` path uses `SavedGlossText` | Already has useful shared word help; needs token speech and baseline parity |
| Reply assistance in the same panel — `ComposerHelp.tsx` | `assistance.replies` uses plain reply strings, translation and sentence reading aids; frames/starters are plain strings | No per-word help. Both branches are wired from conversation data; do not declare the entire suggestions panel covered |
| Coaching source, quoted error and correction — `features/conversation/coaching/CoachEntry.tsx` | Passive `TargetText`; other remarks/fixed text render directly | Existing source glosses are not passed through; new corrections need their own annotations |
| Feedback corrections and remarks — `ConversationFeedbackCard.tsx` | Passive `TargetText` and Markdown | Same gap, including embedded target examples in explanations |
| Coach discussion — `CoachAnalysisPanel.tsx` | Markdown and optional term buttons | Mixed-language spans lack word data and source-language identity |
| Grammar explanations and examples — `features/conversation/reading/AnalysisContent.tsx` | Quotes/examples use passive `TargetText`; bodies use Markdown | Both quoted occurrences and new examples need reading support |
| Partner-reaction excerpts — `features/conversation/partners/PersonaReaction.tsx` | Passive `TargetText` | Copies of already annotated messages lose their word-help data |
| Skill evidence/source records — `features/skills/evidence/SkillEvidenceRecord.tsx` | Passive `TargetText`; rationale plain | Preserve source occurrence and language when inspecting historical evidence |
| Progress and rewards — `features/conversation/progress/{ConversationProgress,RewardsLedger,RewardBadge}.tsx` | Quotes rendered directly | No word inspection; transient reward announcements should lead to inspectable persistent details |
| Start screen greeting, topics and custom-topic summary — `features/conversation/session/{ConversationStart,ConversationChoices}.tsx` | Greeting inside action label; topic target text in `bdi`; summary plain | Need separate inspectable reading affordance without activating start/topic actions |
| Partner names, profiles and pickers — `features/conversation/partners/{PersonaForm,PersonaProfile,PersonaPicker}.tsx`, start screen | Plain labels and editable fields; separate romanized name | Target-script names and target-language excerpts in profile prose need support; keep editing/navigation distinct from reading |
| History titles — `features/conversation/session/ChatHistory.tsx` | Plain text inside navigation controls | Target-language titles need an inspect action that does not navigate accidentally |
| Composer and message/profile/topic editors | Native inputs/textareas | Cannot insert interactive token spans into a textarea; propose a reading preview or selected-text inspection action |
| Language browser, pickers and onboarding — `features/languages/LanguageBrowser.tsx`, `features/settings/{language/LanguagePickers,onboarding/LanguageSetup}.tsx` | Names and selection controls | Native-script language names need inspectable equivalents; use the displayed language, not the active conversation language |
| Language examples, guidance and default partner — `features/languages/LanguageDetails.tsx` | Original/romanized example table, plain guidance and partner fields | Examples have romanization but no gloss/inspection; guidance can mix languages |
| Configuration viewer — `LanguageDetails.tsx` | Resolved JSON, schema, learning/conversation JSON and source YAML in `pre` | Source values containing target language need a readable inspection path while preserving exact source view |
| AI activity content — `features/activity/InspectionContent.tsx`, attempt inspectors | Readable Markdown/structured values or raw source | Neither view supplies word annotations; identify language/content values without treating schema keys or arbitrary metadata as learner text |
| Transcription inspection — `features/conversation/speech/TranscriptionInspector.tsx` | Transcript/segment text and word-timing buttons | Timing selection seeks recorded audio; it is not gloss inspection or synthesized token pronunciation |
| YAML/source detail dialogs — `components/persistence/YamlExport.tsx` and consuming reports | Serialized source text | If target-language content is visible, provide the same inspection entry point without modifying copied/exported source |

### Content and language ownership

`content/languages/*.yaml` contains native names, greetings, learning tokens,
romanization examples, guidance and partner material (including target-language
book/movie titles). For example, `spanish.yaml` includes `hola`, `gracias`, Lucía
and Spanish titles. These are real source occurrences, not just UI labels.

The generated contracts also explain why a renderer-only replacement is
insufficient: `SuggestedReply` carries segments, while `ReplyAssistance` frames
and starters are strings; coaching corrections and many evidence views also lack
the same annotated-text payload. Any later contract work must originate in Rust.

Reading preferences currently come from the global settings-based
`ReadingProvider` and nested conversation preferences. Inspected content may be
in another language or variety. A shared reading surface needs the language and
variety of its source, the learner's gloss language, and source identity/version;
it must not infer these solely from current conversation settings or script.
Latin-script target text in English explanations is a particularly clear case
where script detection is insufficient.

## Token read-aloud audit

No token speaker action is present in `SavedGlossText`, `TokenSpan` or
`GlossPopup`. Existing playback is message scoped:

- [useMessageSpeech](../../ui/src/features/conversation/speech/useMessageSpeech.ts)
  requests `requestMessageSpeech` with a message ID and reads operation audio;
  it handles cancellation, playback permits, rate, volume and stale results.
- [Native speech execution](../../native/src/conversations/execution/speech.rs)
  requires an accepted assistant/persona message, binds speech to its entire
  text and captured context, and validates source ownership. Arbitrary tokens,
  learner messages, corrections and configuration examples cannot use this
  command unchanged.
- [Server audio service](../../server/app/inference/audio_service.py) already
  accepts bounded `{model, text}` synthesis requests and calls the
  [ElevenLabs adapter](../../server/app/inference/elevenlabs.py), using the
  configured service voice. This is a reusable transport capability, not proof
  that token speech is supported end to end. Native direct-provider and
  hosted/custom routes are distinct; do not promise ElevenLabs on every route
  or silently substitute another provider.

Proposed user behavior: a keyboard-accessible speaker button beside the selected
token in its help bubble/detail view; explicit loading, stop and failure state;
the selected original-script text is spoken, never its translation or
romanization. Speech must remain available even when gloss generation fails.
Starting a token should coordinate with existing audio playback and respect
volume/rate. No synthesis on hover or render.

Before choosing contracts/storage, settle the audible unit for grouped clitics:
recommend whole displayed word by default, with individual parts explicitly
selectable in the detail view. Preserve source anchors and uninterrupted Arabic/
Indic shaping. Also settle the voice for non-partner surfaces and make unavailable
ElevenLabs access explicit. These are bounded follow-up decisions, not reasons
to omit any surface from the intended coverage.

## Recommended implementation sequence (not yet authorized by this audit)

1. Define the common learner behavior: click/keyboard word help, gloss,
   romanization/pronunciation preferences, deeper inspection/coach access and
   selected-token speech. Specify missing/pending/failed assistance consistently.
2. Establish shared reading ownership and source-language context. Keep generic
   controls in `components/reading`, domain rules in `domain/reading`, and inject
   feature actions. Do not make shared components import conversation state.
3. Repair conversation-adjacent gaps first: both suggestion paths, coaching,
   explanations and reaction excerpts. Reuse exact saved source annotations for
   quotations where possible; new generated examples require their own help.
4. Extend to evidence/rewards, startup, profiles, language/configuration and
   diagnostic viewers. Provide a companion read/inspect surface for editors,
   raw source views and action labels. Mixed prose needs explicit span ownership.
5. Add source-aware token speech through the existing authorized audio route,
   retaining cancellation, source validation, diagnostic metadata and bounded
   handling. Do not weaken whole-message speech ownership to accept tokens.

## Verification boundaries and later acceptance checks

This audit inspected active UI components, conversation view wiring, generated
types, native speech execution, server audio code and language source data.
Existing unrelated working-tree changes were left intact, including current
activity/language UI additions inspected as part of the working tree. No tests,
live UI interactions, provider requests or audible pronunciation checks were run.
This is a broad source inventory, not proof of every dynamically generated string.

A subsequent implementation should test the same source occurrence across chat,
suggestions, coaching, evidence and configuration; repeated words and exact
offsets; mixed languages; Arabic/Indic shaping and unspaced scripts; missing and
partial glosses; keyboard/touch interaction; popovers in scrolling dialogs;
editing and navigation without accidental activation; token speech cancellation,
stale-source rejection, errors and diagnostic preservation. Confirm actual
ElevenLabs audio in a separately authorized live verification, including short
tokens and the source language/variety. Existing chat tests alone cannot establish
cross-surface parity.

## Implementation follow-up — 2026-09-20

Status: implemented in source after the user authorized the follow-up. The
inventory above describes the pre-change baseline, not current coverage.

### Implemented behavior

- Saved annotations use the shared gloss renderer, including `AnnotatedText`.
  Saved-word helpers and detail dialogs have a separate speaker control; joined
  words retain whole-word shaping and their individual parts can also be spoken.
  The conversation's token-array path retains its existing reveal/drag behavior
  and adds speech and inspection with exact source occurrence context.
- Unannotated `TargetText` exposes local word-selection boundaries. Clicking or
  keyboard-activating a word opens the shared inspector and explicitly requests
  source-bound glosses using the existing native gloss prompt/validator. Rendering
  or hovering does not generate work. Large passages use the containing sentence,
  or the selected word when the sentence exceeds the request limit.
- Both reply suggestion paths, frames/starters, coaching corrections, examples,
  evidence and reward quotes now have reading access. Partner reaction excerpts
  reuse their saved message glosses. Companion controls inspect greetings, topic
  labels, history titles, partner names and language-browser names without
  activating their navigation/insertion controls.
- Selecting text in mixed-language prose, profile/composer/topic editors,
  transcription reports, raw YAML/JSON and AI activity exposes **Inspect selected
  text**. Exact source/editor contents are preserved. This is deliberately a
  selection action for mixed prose and raw data, rather than guessing that every
  English-looking word belongs to the active target language. The inspector
  exposes source language and variety for correction.
- Language-browser and skill-evidence owners supply their own language/variety;
  evidence also supplies its recorded explanation language. The AI window and
  onboarding get the shared entry point. Ask the coach drafts a question without
  sending it, including from the separate AI window; unsaved settings are not
  dismissed to navigate to the coach.
- Explicit token speech uses the hosted/custom speech adapter and the service's
  configured voice (the existing ElevenLabs service route). Direct OpenRouter
  access returns an explicit unavailable-route error; no provider fallback is
  introduced. Speech does not require successful gloss generation. Loading,
  stop, failure and response details are exposed, and playback uses the shared
  rate/volume and lifecycle controls. A new utterance revokes pending older
  playback as well as stopping current audio.
- Reading requests have bounded, single-use native ownership, captured language
  and connection authority, cancellation and no automatic retry. They do not
  create conversation turns or learning credit. A small session cache reuses
  successful reading results for identical text and language context.
- Content-free reading receipts are persisted independently of conversations and
  exposed in the inspector and AI activity. Receipts retain request/operation IDs,
  route/model, timing, usage, provider IDs, errors and bounded redacted metadata.
  Prompts, selected text and audio are not persisted in these receipts. Interrupted
  submitted requests remain unknown, not zero-cost successes.

### Storage and ownership

Native reading ownership lives in `native/src/language/reading/`; application
commands orchestrate it without weakening message-speech ownership. Generic UI
controls live in `components/reading`, app composition injects services, IPC stays
in `platform/ipc`, and speech playback moved from conversation into
`platform/audio` with its tests. No compatibility re-export was added.

The new receipt table requires development schema **25**. Earlier workspaces fail
with the existing explicit reset message; no migration or automatic deletion was
added. This task did not reset the user's workspace, commit, deploy or call a live
AI provider. Concurrent unrelated server-admin and message-speech retry changes
were left intact.

### Verification

- UI production build, including all seven locale dictionaries: passed. Vite
  retains its existing large-bundle advisory.
- UI suite: 869 tests passed across 140 files at the full-suite checkpoint.
  The final message, coaching and progress changes passed 90 targeted tests
  across 19 files; the production build was rerun successfully afterward.
- Native suite with localhost test sockets enabled: 447 passed, 2 ignored. The
  sandbox-only attempt could not bind test sockets; it was rerun with local socket
  access. The new command-level test sends an Arabic token to a local mock speech
  service, verifies exact text/audio publication, and checks durable metadata
  without source/audio leakage.
- Styles, preview type-check, generated design-system and contract checks: passed.
  Generated design-system artifacts were refreshed. `git diff --check` passed.
- Browser fixture: verified saved Arabic gloss layout and shaping, speaker/error
  controls, coaching inspection, and keyboard selection in an editor opening the
  same inspector. Fixture speech is intentionally disabled and reports that no
  provider was called. Fixture meanings are deterministic test data.
- Preview: `ui/tools/reading-preview.html`; preview type-check passed.

Not verified here: live ElevenLabs pronunciation, a rebuilt Tauri application's
microphone/audio lifecycle on physical devices, and visual quality on every OS.
The source implementation and offline verification do not establish those results.

### Visual regression correction — 2026-09-20

The user reported that the first implementation was not visually acceptable:
large speaker buttons, modal-first coaching help, inaccessible suggestion tokens,
misaligned Arabic words, and a final word disappearing after hover/selection.
This follow-up supersedes the initial unannotated-click interaction above.

Implemented:

- Speaker controls are 24px on fine pointers and sit in the helper's corner;
  coarse-pointer hit targets remain 44px. They no longer add a full control row.
- Unannotated words inherit sentence typography instead of the `.w.tap` box
  styling. Their source nodes remain mounted and unchanged through hover,
  loading, pinning and dismissal. Missing meanings appear in an anchored compact
  card after a deliberate 300ms mouse hover or click/keyboard action. Rendering
  and brief pointer passes do not request inference. Successful passage results
  share the inspector's session cache. Detailed inspection is a secondary action.
- The new helper is portalled out of the sentence and positioned in the top layer;
  fetched help cannot change the source's inline layout. Moving from a word to
  its helper has a short grace interval so the speaker remains reachable.
- Saved-word wrappers no longer add padding/borders in plain inline text, and the
  broad target-text top-alignment rule excludes them. Only direct inline
  annotations change a word's column metrics, not descendants in a hover card.
- Removed the suggestions insert button's full-card pseudo-element, which was
  intercepting hover/click events intended for words. No suggestions redesign.

Verification: full UI checkpoint passed 870 tests in 140 files; follow-up targeted
reading/coaching/composer tests and style checks passed. Production build and
preview type-check passed. The offline browser fixture now includes the reported
Arabic correction and final word, main-chat saved help, and unannotated reply
suggestions. Browser checks confirmed compact cards, corner speakers, usable
suggestion word targets, aligned source text and visible final words after
clicking/dismissing help. A regression test also checks source-node identity and
exact sentence contents through hover, request completion, pinning and dismissal;
a brief-pointer-pass test checks no inference request is sent.

Limit: the screenshot's disappearance was reported in the native application.
This pass removed the source-box changes and tested the corresponding sequence
in the browser fixture; it did not reproduce or verify the native WebKit paint
failure in a rebuilt native window. No live provider calls or commits.

### Saved-gloss reuse and unified suggestions — 2026-09-20

Implemented after the user clarified that existing meanings must never take the
new-word lookup path. `ConversationReadingProvider` projects the already-loaded,
durable message and suggested-reply annotations into a shared synchronous read
index. It excludes superseded messages and unregisters its sources when its owner
changes/unmounts. The application reading provider shares registered sources with
other surfaces; this is a projection of saved annotations, not a second database.
Exact passage annotations take precedence. Repeated exact surface forms can reuse
saved meanings in another sentence, with language pair and variety isolation.
Different saved senses remain alternatives; different clitic partitions cannot
produce overlapping rendered anchors. Accents/case are not stripped for matching.

`TargetText` routes locally resolved spans through the same `SavedGlossText`
renderer as chat. Unresolved-word helpers synchronously check saved and session
results before requesting meanings or showing loading state. A newly fetched
word is reusable in a different passage during that session. The existing
request-result memory cache is no longer isolated by full passage for display.
It is still volatile: standalone hover results are not durable linguistic records;
durable conversation glosses continue to come from their existing native storage.
The current projection covers loaded conversation history (including pages the
learner loads), not an offline dictionary or an eager scan of every old chat.

Assisted replies, frames and starters use shared target-text rendering. Removed
unrequested sentence translations and the separate collapsed pronunciation block.
Frames/starters are directly visible. Existing insertion buttons remain separate
from word inspection; no broader suggestions-panel redesign was performed.

Verification: regression tests exercise saved “playa” across coaching, replies,
frames and starters with immediate meanings, pronunciation and zero read-service
calls; a second test covers newly looked-up words reused in another passage with
no loading flash. Language/variety isolation, exact-source precedence, Arabic
clitic offsets and differing saved partitions are covered. Browser fixture checks
show the shared compact saved-word card and the simplified suggestions layout.

### Arabic alignment, mixed examples and error inspection — follow-up

Implemented in source:

- Saved and unresolved words now inherit the same sentence font and line height.
  Unresolved fragments inside saved passages no longer introduce independent
  `dir=auto` isolation or target-text typography. Standalone passages retain it.
- Mixed explanation/example prose isolates source-script runs, leaving Latin
  romanization and translations outside target-script direction and scale.
  The comparison heading selector applies only to its own direct label.
- Conversation error disclosures include Open AI activity. The handoff identifies
  the recorded exchange and matches its error/operation ID to the failed operation;
  it works with a mounted panel and closes the analysis modal before opening it.
  An unambiguous sole failure is a fallback; multiple unmatched failures do not
  pretend to identify a particular operation.
- Romanization validation remains in place. Tests accept accented/decomposed
  pinyin and Arabic transliteration modifier letters. Rejected source-script
  letters now report the reply index, field, Unicode code point and UTF-8 offset,
  without echoing the returned passage. The reported live rejection has not been
  established as a false positive; old receipts cannot acquire missing detail.

Verification: targeted reading/conversation UI suites passed (365 tests), followed
by mixed-text, error-link and AI-panel suites (20 tests); native coaching suite
passed (6 tests). UI production build, type check and stylesheet check passed.
The offline reading preview was visually inspected with the reported Arabic verb
and question particle plus Arabic/Chinese mixed examples. All five Arabic words
had the same 25.5px font, 48.45px line height and top coordinate; opening saved
word help kept the sentence present. Native application rendering/restart and
live provider generation have not been verified in this pass. No commit or deploy.

Final checkpoint: the complete UI suite passed 882 tests in 144 files; preview
TypeScript validation and `git diff --check` also passed.

### Analysis cache routing and passage controls — second follow-up

Implemented:
- The central ReadingHelp lookup now checks durable saved annotations before AI,
  merges saved and session results, and uses canonical language/variety keys.
  The deeper inspector uses this same lookup/peek instead of a private exact cache.
- ConversationReadingProvider supplies the conversation scope to descendants.
  Its provider tree stays stable during hydration to preserve drafts and focus.
  AnalysisContent also registers its pinned turn's available annotations.
- Analysis sentences, quotes and examples use ReadingPassage with the shared
  SavedGlossText renderer, chat bubble styles, word-by-word and available full
  translation controls. Explicit legacy `source (romanization) - translation`
  examples are split; unstructured example content is preserved verbatim.
- Saved source words use the same `reading-word` typography as unresolved words,
  avoiding legacy per-token button borders and metrics. No font assets changed.
- Grouped server refusals retain their specific safe limit code, status and request
  ID. Held-request errors retain refusal metadata; reading failure receipts keep it.

Investigation: the development database contained a service-wide daily-limit hold,
with reset time midnight UTC, whose original handler had reduced its message to
“Server admission refused this operation.” The old receipt cannot distinguish the
specific daily request/allowance limit because that code was discarded. This was
not an Arabic-formatting refusal. Exact saved quote and source matched; found and
removed cache-routing divergences, but did not establish which runtime divergence
produced that particular screenshot. Do not clear holds or change budgets to hide it.

Verification: complete UI suite passed 885 tests in 144 files after implementation;
additional hydration identity regression passed with the targeted reading suite.
Actual analysis modal tests use a rejecting AI service and verify all three saved
word surfaces, word-by-word and translations with zero read-service calls. Native
reading (3), hold policy (4), grouped transport (11 earlier plus the new refusal
regression) and coaching prompt tests passed. Production build, stylesheet and
preview type checks passed. Browser fixture inspection confirmed the actual modal
shows the saved Arabic meaning, source word-by-word glosses and example translation.
Arabic source words use shared baseline metrics in the browser. The native app has
not been rebuilt/restarted for visual verification; live generation was not run.
No commit, deployment, hold reset or app-data deletion.
