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
