# Drill mode — implementation plan (2026-09-22)

Status: **partially implemented; checkpoint history below**. The design sections
retain proposals for future features; they are not a claim that all Drill behavior
is complete. The latest implemented storage behavior and required live check are
in [the retention checkpoint](#cp3-recording-retention-checkpoint--2026-09-22).

Original proposal context: Decisions marked **Agreed** were
made by the learner in design review on 2026-09-22; everything else is a
recommendation awaiting review. The visual design is the "SkellySpeak Drill"
Design canvas (desktop session, set setup, phone session, phone attempt detail,
phone settings sheet).

Revision history:

1. First draft.
2. The learner's revised plan: mandatory reuse gate plus readiness review (§9).
3. This revision:
   - adds the traced reuse map (§3);
   - replaces the earlier parallel Drill stack in §5 with extractions (§4) and a
     minimal Drill-owned remainder;
   - reorders the work (§7).

4. Follow-up review: proceed in bounded implementation slices with the review
   checkpoints in §10. Correct accounting/playback assumptions and constrain E2.

The earlier "Design details" and "Phases" sections are **superseded** by §4–§7.
This file incorporates the supplied follow-up proposal and the current review.
The reuse and shared-spectrogram requirements are agreed; implementation choices
below remain recommendations unless explicitly identified otherwise. No application
implementation or device verification is claimed by this revision.

**Controlling requirement (agreed with the learner, 2026-09-22):**

- Drill is another composition of the existing app capabilities.
- Existing functionality must use the same implementation in Chat and Drill.
- When conversation coupling prevents reuse, fix that boundary and move Chat onto
  the shared implementation before adding Drill.
- Do not build parallel implementations, approximate substitutes or a separate
  Drill backend stack.
- This requirement supersedes earlier sketches and review recommendations
  wherever they conflict.

## 1. What drill mode is

A second practice surface beside the chat. The app offers a word, phrase or
sentence in the target language, and the learner says it repeatedly. Every
utterance becomes an attempt that is transcribed, compared with the target and
listed. The learner can record another attempt while earlier attempts are still
being processed.

### Agreed decisions

| Topic | Decision |
| --- | --- |
| Placement | A Chat / Drill switch on the conversation page replaces the whole chat view. Desktop and phone layouts are both first-class. |
| Target display | The **same** partner-message presentation and tools as Chat: glosses per word, romanization, translation, Analysis, Listen and slow playback. |
| Capture modes | Three learner-selectable modes: hands-free loop (a pause ends an attempt), tap-to-start with automatic end, and tap-to-start with tap-to-stop. |
| Pause length | Learner setting, used by the two automatic modes. |
| Auto-advance | "Next item after N matches". N is a learner setting; 0 means off. Nothing is hard-coded. |
| Play reference first | Learner setting. |
| Settings persistence | All drill settings persist across sessions. |
| Item sources | Checkboxes in any combination: generated at level, the learner's conversations, the skill map, the learner's own phrase. |
| Difficulty | The same difficulty definitions, defaults, controls and prompt rules as Chat. Below / at / above selects existing levels. There is no Drill-specific difficulty policy or length table. |
| Recognizer | The same transcription route and language forcing as Chat. |
| Target hint | Sending the target text to the recognizer is a setting, **off by default**. Attempts are labelled hinted only when a hint actually reached the recognizer. |
| Scores | Text comparison is the primary result. Recognizer metadata, duration and spectra are shown as separate measurements, not as grades. |
| Spectrograms | **Agreed (D4):** improve the shared spectrogram analysis and renderer for Chat and Drill. Drill composes two instances on a shared time axis. |
| Phone attempt detail | Tapping an attempt opens its detail screen. |
| Evidence | Drill results become a **separate evidence type** on the skill map. |
| Storage | Scores, transcripts and audio are kept. A setting caps or clears stored audio. |

### Consequences to record

- **Stored audio and transcripts are new.** `speech/recording/transcription.rs`
  says: "Metadata-only receipts for volatile audio. No replayable audio or
  transcript store."
  - Drill departs from this for drill attempts only, and Chat recording behaviour
    is unchanged.
  - That module comment, the native README and the privacy text in Settings must
    all say so.
- **Recording and transcription stop being conversation-bound.** The shared
  capture and transcription path gains an explicit owner (§4, extraction E3), and
  Chat moves onto it.

## 2. Shared architecture requirement and reuse gate

This is a product requirement, not an optimization to attempt if convenient.
"Reused" means the same code path and behavior. Similar markup, duplicated
algorithms, matching names or separately maintained copies of configuration do
not count.

Before implementing each capability:

1. **Trace the current Chat path end to end.** Cover UI/actions, state, language
   context, native services, persistence, diagnostics and tests, and record the
   existing owner. §3 is the first pass of this trace.
2. **Use that path directly where possible.** Where it is coupled to a
   conversation, extract the existing capability into its shared owner with
   explicit inputs and results. Conversation scheduling, turn ownership and
   rewards stay with Chat.
3. **Switch Chat to the shared implementation in the same extraction change** and
   verify existing behavior. Drill then supplies its own source and session context.
4. **Add only behavior that existing capabilities cannot express.** State what is
   new and why, and test it with its owner. Shared capability tests live once with
   that owner; mode integration tests check wiring and lifecycle.

Limits on the extraction:

- No generic plugin framework, universal practice engine, parallel scheduler or
  speculative abstraction.
- Extract the smallest coherent capability needed by the two actual consumers.
- Separate context adapters are appropriate; duplicated capability
  implementations are not.
- Different durable ownership or retention policies do not justify duplicating
  capture, provider execution or rendering.

## 3. Reuse map (source traced 2026-09-22)

The trace covered source reading only. Nothing was run or changed.

| # | Capability | Chat path today | Coupling found | Resolution |
| --- | --- | --- | --- | --- |
| C1 | Partner-message presentation and tools | `TurnView.tsx` (384 lines) renders the assistant bubble inline: token spans, `SavedGlossText`, `TranslationStatus`, Translate / Word by word / Analysis buttons, the speak control, `GlossPopup`, `AnalysisSentence`. Chat-only parts (`MessageXpButton`, `PersonaReaction`, evidence styling from `SkillEvidenceContext`, `PracticeContext`) are mixed in. `ReadingPassage.tsx` is a second, smaller renderer used by `AnalysisContent`, `AnalysisSentence`, `ReadingExample` and `ReplyHelp`. | The bubble takes `GuidedTurnResult` and turn fields directly. There are two renderers for the same concept. | **E1** |
| C2 | Aids execution: translation, word gloss, analysis, speech | Turn operations in `conversations/execution/` (`reply_translation`, gloss, `reply_explanations` via `assistance::request_explanations`, `persona_speech` via `execution/speech.rs`). They go through `dispatch.rs` / `publication.rs` / `attempts`, with receipts, retries, diagnostics and the AI activity view. `operations.turn_id` is `NOT NULL` and dispatch joins `turns`. A second path already exists: `language/reading` (`begin_reading` / `run_reading`) does ephemeral gloss (reusing `conversations::gloss`) and token speech. That speech is limited to 256 UTF-16 units and refuses the OpenRouter route; it has no translation or analysis. | Chat aids are bound to turns. The context-free path is partial and its speech is route-limited. | **E2**, decision **D10** |
| C3 | Microphone capture | `speech/recording/voice.rs::mic_start(conversation_id)`: one `Application.capture` slot, language resolved from the conversation, the previous partner message used as context. Desktop uses cpal (`audio.rs`); phone uses `browser-recording.ts` (AudioWorklet, Float32 at the context rate, 2-minute cap). `useMicRecorder.ts` drives it. | The conversation ID is required throughout. | **E3** |
| C4 | Transcription execution and receipts | `mic_transcribe`, then admission (`state.admission.audio`), holds, pause, `ai::policy::retry`, `ai::audio::transcribe`, adapters. Receipts are in `transcription_attempts(conversation_id NOT NULL)`, and `permitted()` checks the conversation and contact. Usage statistics read this table. | Conversation-owned receipts. | **E3** |
| C5 | Recording inspection and spectrogram | `inspect_wav(wav, recording, conversation)` produces `AudioInspection{conversation_id, …}` with a linear dB STFT spectrogram (0–8 kHz, about 129 bins). `TranscriptionInspector.tsx` owns the `Spectrogram` canvas. | Conversation ID in the contract; the spectrogram quality is poor. | **E4** (agreed D4) |
| C6 | Playback | `platform/audio/speech.ts` (exclusive permit, `interruptSpeech`, `onSpeechInterrupted`), `speech-player.ts`, `playback-lifecycle.ts`, `useMessageSpeech.ts`, `reading-speech.ts`. | Playback authority is reusable, but `onSpeechInterrupted` is not a complete start/stop notification API. | Reuse and extend the shared lifecycle for playback/capture coordination (§5.3), covering every playback caller. |
| C7 | Difficulty | The `Difficulty` contract and `DifficultySelect.tsx`. `conversation_prompt::difficulty(language, label, key…)` renders `content/prompts/conversation/instructions.yaml → difficulty.<level>` plus the ceiling. Validation requires all five levels. | The level text is written as instructions for a *partner's utterance* at that level. | **E5** |
| C8 | Target-language item shape (text, translation, romanization, pronunciation) | `learning/coaching/conversation_support.rs` reply suggestions already generate target-language items at the selected difficulty, with their schema and validation. | Bound to the reply-help turn context. | **E6** |
| C9 | Preferences | `model.rs::Preferences` saved through `Action::UpdateLearner` (the command transaction). The appearance pattern (`configuration/appearance.rs`) owns defaults, validation and contract export. | None. | Add `Preferences.drill` using the appearance pattern. No new command. |
| C10 | Conversation sentences and coach corrections | The `messages` table and `conversations/revision.rs::coach_edits`. | None (read-only source). | Reuse directly. |
| C11 | Skill catalog and evidence presentation | `learning/learner/learner_state.rs::fold`, `features/skills/`, `components/learning/`. | The fold consumes assessment judgments only. | Drill evidence is a separate record rendered with the existing skill components (D1). |
| C12 | Diagnostics and AI activity | `ResponseDetails`, `ErrorDetails`, `diagnostics::response::retained`, `features/activity/`. | Some activity projections may assume turn ownership. | Reuse existing diagnostics and activity UI; audit and test source-neutral activity queries/projections during E2. Shared tables alone do not guarantee visibility. |

Findings to fix in their own right, recorded but not part of Drill:

- **Wrong prompt argument.** `transcription_context::prompt(native_name, …)`
  documents a native language name, but the Groq adapter passes `language_tag`
  (`transcription_adapters.rs:82–84`).
- **Context not sent everywhere.** The ElevenLabs adapter sends no prompt/context
  and fixes `no_verbatim=false`. The Service adapter passes context raw.

Hint support is therefore per-route and must be inventoried (Phase 0) before the
hint setting is offered (§5.4).

## 4. Extractions (bounded reviewable slices; Chat migrates with each shared capability)

- **E1 — shared target-message component.**
  - Extract the assistant-bubble presentation and actions from `TurnView.tsx` into
    one component (proposed: `components/reading/TargetMessage.tsx`).
  - It takes a source-neutral view model: text, tokens/gloss, translation,
    romanization/pronunciation, aid states and errors, speech state. Actions are
    callbacks supplied by an adapter.
  - Chat-only elements (XP button, persona reaction, evidence styling) are slots
    supplied by `TurnView`. `TurnView` then composes `TargetMessage`.
  - `ReadingPassage`'s overlapping responsibilities are consolidated into it (a
    compact variant). Its four consumers move over, and the separate renderer is
    removed.
  - Shared components must not import feature state, so the adapter lives in each
    feature.
  - Tests: move the existing `TurnView` and `ReadingPassage` presentation tests to
    the component. Add a test that renders it with a non-conversation source.
- **E2 — source-scoped aid operations (per D10).**
  - Generalize the owner of operations from "turn" to an explicit source
    (`turn | drill_item`), so translation, gloss, analysis and speech run through
    the **same** dispatch, attempts, receipts, retry, diagnostics and publication
    code.
  - Turn scheduling and turn state stay in Chat. A source adapter supplies text
    and the explicit language / variety / explanation scope.
  - Extract only the common aid preparation/execution/result-validation machinery
    and durable operation lifecycle needed by the two consumers. Chat adapters
    retain turn graph dependencies, scheduling decisions, turn publication and
    reward ownership. Drill adapters publish to drill items. Do not spread owner
    switches through unrelated conversation operations.
  - Start with one aid end to end, then extend the proven boundary to the others.
    Shared execution/receipt logic must remain single-owner code; adapters may
    differ in scheduling and publication destination, not duplicate that logic.
  - Preserve Chat's durable/prefetched aids. Tests must preserve behavioral
    assertions, not merely pass after expected results are weakened. Owner-related
    setup changes are expected; add cancellation/recovery/publication tests.
  - Review the first extraction at checkpoint CP2 before propagating its owner
    model through the remaining aid types. D10 does not require asking the learner
    to choose a database or scheduler design in advance.
- **E3 — owner-neutral recording and transcription.**
  - `mic_start` / `mic_transcribe` take `RecordingOwner = Conversation{id} | DrillItem{id}`
    with language and optional context resolved and validated natively from that
    owner. IPC must not trust caller-supplied language or owner authority. Shared
    internal execution receives the captured, validated scope.
  - The Chat adapter resolves these from the conversation exactly as today.
  - `transcription_attempts` gets owner columns with exactly one owner set.
    `permitted()` validates each owner kind.
  - Usage statistics reuse the same accounting implementation, but their queries
    must change: current `statistics/mod.rs` joins transcription receipts through
    conversations and contacts (confirmed at `statistics/mod.rs:15`). Include
    Drill in global and language totals, preserve unknown usage and distinguish
    learner attempts from reference checks. Partner-scoped reports must not
    attribute Drill to an arbitrary conversation partner. Audit aid usage and
    activity projections too.
  - The same `Application.capture` slot enforces one active recording across
    Chat and Drill.
- **E4 — shared log-mel inspection and renderer.**
  - Add a mel filterbank over the existing STFT in `speech/analysis/`, replacing
    the linear bins.
  - Make `AudioInspection` owner-neutral.
  - Extract the `Spectrogram` canvas to `components/media/`. The Chat inspector
    uses it, and Drill composes two instances on a shared axis.
  - Specify sample-rate handling, window/hop, filter normalization, dB reference,
    colour scale, Nyquist behaviour below 16 kHz, and tolerances rather than
    identical results across rates.
- **E5 — difficulty policy.**
  - Extract the reusable difficulty resolver to its existing appropriate shared
    domain/configuration owner if needed; both the conversation composer and Drill
    call it. Merely exposing a conversation implementation to other features is
    not the intended lasting dependency. Preserve existing policy text/behavior.
  - Drill's generation task asks for "things a conversation partner would say at
    this level", which is exactly what the existing level text describes. This
    reuses the rules honestly instead of reinterpreting them.
  - Move `DifficultySelect` and its shared labels to a shared UI owner and update
    Chat callers in the same slice; preserve control behavior. The canvas's chip
    control is updated to match it. Do not add old-path re-export aliases.
- **E6 — target-language item schema.**
  - Extract the item shape and validation from reply suggestions
    (`conversation_support.rs`) into a shared definition used by reply help and by
    drill generation.
  - Extract only the common item fields, language-dependent schema rules and
    validation. Keep reply-help envelope/cardinality and Drill set metadata with
    their task owners. Reply help's prompt and behavior remain unchanged.
- **E7 — capture streaming and segmentation (new shared speech behaviour).**
  - Add streaming delivery and utterance segmentation to the E3 capture owner:
    - desktop: the cpal callback feeds a bounded worker, with no FFT, file or
      database work in the callback;
    - phone: the worklet streams sequenced PCM chunks with sample rate and format,
      discontinuity detection and backpressure.
  - Tap-to-start/stop is the existing Chat behaviour. Overflow is an explicit
    capture failure.

## 5. What Drill newly owns (the minimal remainder)

`native/src/drill/` owns only:

- sets, items, sessions and item visits;
- source selection;
- the generation *task* prompt;
- progression and auto-advance;
- attempt-to-target comparison;
- drill attempt result rows;
- drill evidence aggregation;
- drill audio retention.

Commands exist only for these. Recording, transcription, aids, playback,
inspection and preferences use the extracted commands above.

### 5.1 Data model sketch (clean schema; final SQL follows D12)

- **`drill_sets`**: language, variety, difficulty, sources, mix, focus, revision,
  archived.
- **`drill_items`**: set, position, text, source, `source_ref` (with revision),
  requested focus vs validated tags, and a reference for the aid operations (E2).
- **`drill_sessions`**: set, started, ended, end reason.
- **`drill_visits`**: session, item, entered and left, and a match counter scope
  per D12.
- **`drill_attempts`** (the Drill-owned result only):
  - `transcription_attempt_id` (E3 receipt: route, model, state, diagnostics);
  - visit, sequence, capture mode, hinted (effective);
  - audio file, bytes, pruned-at;
  - original transcript, normalized forms, alignment with offsets;
  - scoring policy version, reference identity.

No receipt state machine is duplicated. Provider outcome and usage live in the E3
receipt; local inspection, scoring and publication failures are recorded
separately so a paid request is never shown as an unbilled local failure.

### 5.2 Scoring (per the readiness review; replaces the earlier rules)

- **Text match.** Grapheme-cluster CER with an explicit reference denominator and
  rules for an empty target or empty transcript. Original texts and offsets are
  kept.
- **Normalization.** Declared per language in `content/languages/*.yaml`, and the
  transformations applied are recorded. A normalized match does not claim that
  diacritic-level distinctions were spoken.
- **Alignment.** Deterministic, with explicit `same`, `substituted{similarity}`,
  `missing` and `extra`. RTL and mixed-script fixtures are required. Character
  alignment is used where the language data says there are no word spaces.
- **No script-derived `other_language` verdict.** At most an advisory "script
  mismatch", with an unknown case. It never overrides the measured score.
- **Recognizer metadata.** Stored and shown with provider, model, field name and
  aggregation (for example Whisper `avg_logprob` as a log probability, not "mean
  token probability"). When absent, the reason is shown.
- **Duration and spectra.** Shown as measurements, with their method. They are
  never scores.
- **Thresholds.** The verdict thresholds, including the match rule used by
  auto-advance, are data with a policy version.

### 5.3 Capture lifecycle (resolves readiness review items 3–5; defaults for review)

- **App playback.** Reference audio and replays are never attempts. Segmentation
  suspends through the shared playback authority, clears affected pre-roll and
  re-arms explicitly afterwards. Extend that authority with the required lifecycle:
  current interruption callbacks do not establish playback start, natural end or
  every error path. Cover reference, attempt replay, token speech and Chat playback;
  fence stale completions so they cannot re-arm a stopped/new recording. Apply
  capture exclusion to manual recording as well as automatic segmentation.
  Test on speakers, not only headphones.
- **Leaving Drill.** Leaving Drill, or a language change, backgrounding, locking,
  a disconnect or loss of permission, **stops** capture with a stated reason.
  Opening detail or settings **suspends** it visibly. Accepted attempts finish
  processing.
- **Stop controls.** Stop, discard current utterance, cancel pending and end
  session are distinct commands.
- **Time bounds.** Tap-auto has a no-speech timeout. Tap-manual keeps the existing
  2-minute bound. A hands-free utterance is cut at the policy maximum and marked
  as cut off.
- **Suspension.** Queue saturation (D9), sustained failures or an admission
  refusal suspend capture until an explicit Resume. The listening, queued and
  processing counts are shown separately. Session limits (requests, bytes,
  minutes) are policy data.
- **Auto-advance.** It is native. The audio is bound to the item visit when the
  utterance **starts**. A match arriving mid-utterance advances once at the next
  capture boundary. Late results never advance a newer visit. Poll duplicates
  never double-count.

### 5.4 Hint

The setting is offered per route only where Phase 0 shows the hint reaches the
recognizer. Elsewhere it is disabled, and the reason is stated. An attempt stores
the effective hint, not the requested one.

### 5.5 Sets and sources

- **Mix across levels.** The mix uses existing adjacent levels: at the first or
  last level, "below" or "above" is unavailable and is shown as such.
- **Size and ordering.** Total size, per-source allocation, deduplication and
  stable order are defined.
- **Shortages.** A shortfall in any source is shown in the preview with any
  proposed generated replacement. Nothing is invented silently.
- **Conversation source.** Sentences come from the messages and `coach_edits` of
  this language and variety, with exact provenance. Their level is unclassified
  unless the source carries one.
- **Own phrase.** Uses the selected difficulty context, with no inferred level.
- **Generated.** One structured completion. It uses the E5 difficulty text and the
  E6 item schema, and adds only the drill task text (in
  `content/prompts/drill/instructions.yaml`). Mechanically checkable constraints
  are validated. A failure shows a Regenerate button, with no automatic retry.

### 5.6 Reference audio (D5)

- **Source.** The item's speech aid through E2, which is the same speech path as
  Chat's persona speech, not the route-limited reading speech.
- **Consistency check.** The optional ASR consistency check is an E3
  transcription with `owner = DrillItem`, stored as unchecked, checking,
  consistent, inconsistent or check-failed. Its cache key is text, language and
  variety, voice and model, audio identity and policy.
- **Counting.** Reference checks are counted separately from learner attempts.

### 5.7 Retention and workspace (moves into the first audio slice)

- **Setting.** The cap setting (D8) states whether it covers references.
- **Files.** Queued or in-use files are protected. Orphans are reconciled after
  interruptions. Disk-full is an explicit failure.
- **Keep none.** Means temporary processing files are cleaned on success, on
  failure and on restart.
- **Reset and export.** Factory reset and workspace export are covered.
- **Deletion.** Explicit deletion of transcripts and scores is separate from
  archiving.
- **Size limits.** Stored inspection JSON is bounded, and attempt and set lists
  are paginated.

### 5.8 UI composition

- **Navigation.** `navigation.ts` gains `practiceView: 'chat' | 'drill'`.
  `SurfaceHost` keeps the page mounted but capture follows §5.3.
- **Folders.** `features/drill/` holds only composition and Drill-owned views:
  set rail, setup, attempt log, attempt card, word alignment, the paired
  inspection layout, the mic dock and the phone screens.
- **Shared parts.** The target card is E1 `TargetMessage` with a drill adapter.
  Spectrograms use the E4 component. The recorder hook is the E3/E7 hook with a
  drill owner. The difficulty control is `DifficultySelect`. Settings go through
  the existing learner update.

## 6. Decisions

| # | Question | Recommendation | Status |
| --- | --- | --- | --- |
| D1 | Drill evidence on the skill map | Per construct: items drilled, attempts, exact matches, sessions, last drilled, and hinted vs unhinted. Shown separately from demonstrated competence; it does not feed `learner_state::fold`. Requested focus is distinguished from validated tags. | Proposal |
| D2 | Drill XP | None in v1. | Proposal |
| D3 | Where segmentation runs | Native, one implementation on the E3 capture owner (E7). | Proposal, pending Phase 0 |
| D4 | Shared spectrogram improvement | One analysis, contract and renderer for Chat and Drill. | **Agreed** |
| D5 | Reference consistency check | Yes, as specified in §5.6. Whether an inconsistent reference still permits practice without reference audio is open. | Proposal |
| D6 | Phone navigation in drill | Bottom nav hidden; the header switch returns to Chat; the mic dock sits at the bottom edge. | Proposal |
| D7 | Drill language | The active practice language and variety, not a conversation. | Proposal |
| D8 | Audio retention default | 500 MB, oldest first; options 100 MB / 500 MB / 2 GB / keep none. | Proposal |
| D9 | Queue | One in flight, 5 waiting; saturation suspends capture (§5.3). | Proposal |
| **D10** | How aids run for drill items | Recommended working direction: E2, preserving durable/prefetched Chat behavior and sharing capability execution/receipts through explicit source adapters. Do not replace Chat aids with ephemeral/on-demand behavior, or create hidden turns. This is not a forced choice between the two entire existing pipelines; inspect the smallest common boundary. | Engineering direction reviewed against code at CP2; does not block E1 |
| D11 | Generated item schema | Reuse the reply-suggestion item shape (E6). | Proposal |
| **D12** | Session and visit semantics | A session starts when Drill opens with a set and ends on leaving or on explicit End. Returning to an item starts a new visit, and its match counter resets. Auto-advance counts matches within the visit (not necessarily consecutive). | Working default for implementation; review with the first usable slice at CP3, before calling the behavior settled |
| D13 | Existing `language/reading` duplication | Inventory overlapping work during E2. Reuse common capability execution and validation in all affected paths; an ephemeral request and a durable aid may retain different lifecycle adapters. Do not extend duplicate capability implementations. Any residual duplication must have a named owner and explicit checkpoint disposition. | Review at CP2 |

## 7. Order of work

Phase 0 spikes run alongside Milestone A. They are:

- a bounded 10-minute streaming harness on iPad and Android, with a resampling
  decision;
- a per-route inventory of hint and confidence behaviour, using fixtures, with
  live calls only with approval;
- exploratory reference consistency on a few clips.

Device access is a prerequisite. The ten clips are exploratory, not validation.

**Milestone A — extractions.** Start with E1 and E5 to establish visible reuse
(CP1); then E4/E3 and the first end-to-end E2 aid (CP2). E6 can wait until generated
items need it. This is a dependency-based order, not a mandate to refactor every
candidate before trying the first working Drill slice. Each extraction is bounded;
large ones may require multiple cohesive reviewable diffs:

- Chat is migrated in the same change.
- Chat's existing behavioral tests pass; preserve assertions while updating setup/contracts as needed.
- Shared capability tests live with the new owner.
- There is a non-conversation source test.

Only E4 intentionally changes Chat's visible behavior (the agreed spectrogram
improvement). Use D10's working engineering direction and inspect the first E2
slice at CP2. The numbered checkpoints below are the review handoffs.

**Milestone B — first vertical slice.** This covers:

- own phrase with `TargetMessage`;
- tap-to-start/stop capture with a `DrillItem` owner;
- reference playback;
- a durable attempt with transcript comparison;
- replay;
- the paired spectrogram;
- bounded retention and deletion, and failure recovery;
- the narrow-screen layout.

**Milestone C — automatic capture.** E7 segmentation, hands-free and tap-auto
modes, the §5.3 lifecycle, the queue, native auto-advance with race tests, and
real-device checks.

**Milestone D — sets and evidence.** Generated, conversation and focus sources,
the D5 check, and drill evidence (D1).

**Tests required across the milestones:**

- interruption;
- duplicate notification;
- a late result after a reset or item change;
- speaker self-capture;
- queue saturation;
- an unsupported hint;
- disk full;
- crash recovery.

**Checks.** Run the relevant ones for each change, and the full suite at each
milestone:

- `npm run build`
- `npm run contracts:check`
- `npm run styles:check`
- `npm test`
- `cargo fmt --manifest-path native/Cargo.toml -- --check`
- `cargo clippy --manifest-path native/Cargo.toml --lib --tests -- -D warnings`
- `cargo test --manifest-path native/Cargo.toml --lib`

Keep compilation, automated verification and real-device verification distinct.
No commits without an explicit instruction.

## 8. Risks and out of scope

| Risk | Mitigation |
| --- | --- |
| E2 touches the turn execution core (dispatch, publication, recovery) | Bounded first-aid extraction reviewed at CP2; preserve behavioral assertions and verify transaction, cancellation and recovery boundaries. No intentional behavior change for Chat. |
| Hosted route cost and quota under continuous use | Session limits, the visible counts and queue suspension (§5.3). |
| Phone background or lock kills the stream | Phase 0; capture stops with a stated reason; no silent resume. |
| Reference speech differs from the text | The D5 check with explicit states. |
| Recognizer normalizes the learner's speech | Hint off by default; route and effective hint shown per attempt. |
| Scores read as a pronunciation grade | Fixed copy: "Scores compare the transcript with the target. They are not a pronunciation grade." D1 counts, not levels. |

Out of scope for v1:

- phonetic or forced-alignment scoring;
- per-phoneme feedback;
- native-speaker validation;
- automatic provider fallback;
- cross-device sync;
- drill XP (D2).

## 9. Implementation-readiness review (2026-09-22, incorporated)

The learner's revised plan included an external readiness review. Its
requirements are incorporated as follows:

- session and visit identity → D12 and §5.1;
- native auto-advance and races → §5.3;
- playback/capture exclusion → §5.3;
- leaving and stopping → §5.3;
- bounded continuous use → §5.3 and D9;
- score semantics → §5.2;
- reading speech limits and route refusal → C2 and D10;
- per-route hint behaviour → §3 findings and §5.4;
- browser PCM format and streaming → E7;
- owner-neutral inspection and no work in the cpal callback → E3, E4 and E7;
- reference check states and caching → §5.6;
- segmentation test cases → Milestone C;
- mel and sample-rate specification → E4;
- sets, provenance and shortages → §5.5;
- retention, deletion and recovery → §5.7;
- the review's implementation order → §7.

The requirements above summarize the previous review; historical conversation
text is not an additional implementation dependency. Where earlier recommendations
conflict with the reuse requirement, the reuse requirement governs.

## 10. Review checkpoints — agreed working process, 2026-09-22

The learner requests concrete check-in points and an ongoing assessment of staged
work, with their help inspecting the result. Proceed with bounded implementation
using the working defaults above; do not prolong design review with exhaustive
advance questions. “Staged work” here means the current reviewable changes, whether
Git-staged or unstaged. A checkpoint is not commit authorization.

At each checkpoint, leave a coherent diff and a short handoff **in this file**,
then return for review before moving into the next checkpoint's scope. The reviewer
and learner will assess actual code and, where available, the running UI. Routine
implementation choices and checks within a checkpoint do not need further approval.
If evidence exposes a fundamental problem, report that concrete finding rather
than expanding into a broad rewrite. Do not mark a checkpoint passed merely because
its code compiles or its author says it is complete.

**Working environment.** Implementation runs in a clean clone of `main` at
`7ebf53d5` in the agent's Linux workspace, where the Rust and Node toolchains and
Linux Tauri system libraries are installed. The learner's checkout has no Rust
toolchain in the agent's shell and macOS-only `node_modules`. At each checkpoint
the changed files, plus a patch, are copied into the learner's checkout (unstaged,
uncommitted), and the handoff lists them. Linux automated checks do not replace a
run of the macOS app; the handoff says which was done.

### CP1 — the same message tools and difficulty in both contexts

Deliver E1/E5 with Chat migrated, overlapping `ReadingPassage` rendering consolidated,
and a non-conversation fixture/harness demonstrating the shared message tools.
Exercise translation, token glosses, romanization, analysis and playback actions,
including loading/errors and reading preferences. A stub-only fixture proves
presentation wiring, not working native aid execution; state that limitation.

Review: Does Chat still behave correctly? Is there one implementation per
capability? Are feature adapters thin, and are shared components free of Chat
state imports? Did we remove the overlapping old implementation? The learner
checks the visible controls and reading behavior. E1 may be split internally;
complete this coherent checkpoint before expanding native execution.

### CP2 — shared native execution, capture and improved spectrogram

Deliver E3/E4 and one working aid through the proposed E2 boundary, with Chat and
a non-conversation source consuming the same capability. Show the improved Chat
spectrogram. Finish remaining shared aids only after this first boundary is reviewed;
record their subsequent verification in the same checkpoint before CP3.

Review: Is E2 a bounded extraction rather than a scheduler rewrite? Preserve turn
transactions, dependency/reward ownership, cancellation, pause/holds, stale-source
rejection, recovery and useful redacted receipts. Verify global/language accounting
includes the new owner and no partner attribution is invented. Show real playback
lifecycle coordination and one capture authority. Verify source-neutral activity
visibility instead of assuming it. Inspect the spectrogram visually as well as
checking numerical fixtures. If only the first aid is done, label the checkpoint
partial and identify the remaining aids.

### CP3 — first usable Drill slice

Deliver Milestone B: own phrase, the exact shared message tools, manual recording,
reference playback, durable transcript comparison, replay/paired inspection,
retention/deletion and recovery, with narrow-screen layout. Include the session and
visit working defaults (D12). Playback exclusion applies even in manual mode.

Review: The learner tries the complete workflow and confirms/corrects session/visit
behavior. Check that actual translation, analysis and speech use the shared services,
not mocked functionality or a reduced renderer. Test leaving/re-entering, changing
language, failures, deletion and unavailable audio. Record whether testing used a
running app, browser harness or only automated fixtures. Resolve lifecycle problems
before hands-free operation multiplies them.

### CP4 — continuous recording and progression

Deliver Milestone C with streaming/segmentation, queue control, native auto-advance,
all three capture modes and device verification where devices are available.

Review: Speaker playback cannot become attempts; delayed results and duplicate
notifications cannot advance the wrong visit; bounded queues remain bounded; Stop,
Resume, backgrounding and permission loss behave visibly and predictably. Try short
words, quiet speech, noisy input and speech spanning a cutoff. Report unavailable
devices as unverified, not passing. Device-dependent readiness remains open until
those checks can actually run; unaffected work may continue after review.

### CP5 — full sources, evidence and final regression review

Deliver Milestone D, including E6 where needed, generation/source selection, shared
difficulty rules, reference checks and separate drill evidence. Review D1/D2/D5/D8
against the concrete implemented UI and defaults; keep unconfirmed defaults labelled.

Review: Item sources and shortages are honest; hints record actual provider behavior;
practice counts do not masquerade as proficiency; all provider usage is accounted for.
Verify retention/reset/export across both recorded and reference audio. Run required
integration checks and inspect Chat for regressions. Do a final duplication audit:
shared capabilities have one implementation, retired paths are removed where replaced,
and any remaining overlap is explicitly justified. No automatic commit or deployment.

### Handoff template for every checkpoint

- **Status:** ready for review / partial / blocked, with the exact scope.
- **Changes:** short explanation and concrete file/symbol links for the shared
  owner, both consumers, and removed/replaced code. Include current Git status and
  identify unrelated changes excluded from the review.
- **Reuse/complexity:** what was reused, extracted, removed and newly necessary;
  explain new owner variants or abstractions. File/line counts are context, not a
  success metric; inspect the number of independent implementations and boundaries.
- **Verification:** commands and outcomes, preserved behavioral assertions, actual
  app/device checks and explicit unverified cases. Do not weaken tests to hide a
  changed Chat behavior.
- **Inspect:** exact steps and the currently available artifact/app to review.
- **Decisions/issues:** only concrete product choices or findings exposed by this
  slice; distinguish bugs from optional improvements.
- **Review outcome:** pending until reviewed, then record corrections and the
  agreed next scope. Review completion does not authorize a commit.

Current checkpoint status: **CP1 ready for review** (2026-09-22).

### CP1 handoff (2026-09-22)

- **Status:** ready for review. Scope: E5 (difficulty) and E1 (target-message
  tools) with Chat migrated. No Drill UI, native aid execution or capture work.
- **Changes.**
  - E5 native: new single owner `native/src/configuration/difficulty.rs`
    (`LEVELS`, `key`, `prompt_label`, `instruction`). It replaces four separate
    level lists and the formatter in `conversations/conversation_prompt.rs`
    (`difficulty()` removed), `diagnostics/ai_graphs.rs` and
    `configuration/validation.rs`. Prompt text and output are unchanged.
    `model.rs` exports the level order as the generated
    `DIFFICULTY_LEVELS` contract.
  - E5 UI: `DifficultySelect` and `difficultyLabel` moved from
    `features/conversation/session/` to `components/controls/DifficultySelect.tsx`
    and read `DIFFICULTY_LEVELS`. Chat callers (`ConversationPage`,
    `ConversationChoices`, `ConversationPromptCreator`) were updated; there is no
    alias at the old path. An unknown value now throws instead of being ignored.
  - E1: new `components/reading/TargetMessage.tsx`, one target-language message
    with word meanings, translation, whole-message romanization/pronunciation,
    read-aloud and analysis, laid out as `bubble`, `passage` or `compact`. The
    owner supplies data, status, annotation and actions; it imports no feature
    or app state.
    - `TurnView` composes it for the partner bubble (persona reaction as
      `annotation`; translation and gloss status as `status`).
    - Reading preferences come from `ReadingPreferencesContext`, not duplicated
      props.
    - `ReadingPassage.tsx` is removed. Its four consumers (`AnalysisSentence`,
      `ReadingExample`, `AnalysisContent`, `ReplyHelp`) and `tools/reading-preview`
      use `TargetMessage`.
  - Legacy token path removed (learner-approved). Production always had
    `tokens: []` (`domain/conversation/conversation-view.ts:34`), so the
    per-token renderer could not be reached. Fixture tokens are converted by the
    existing `anchoredTokenGlosses` and rendered by `SavedGlossText`. Removed:
    - files: `components/reading/TokenSpan.tsx`,
      `features/conversation/reading/GlossPopup.tsx`,
      `features/conversation/reading/useWordInspection.ts`,
      `domain/reading/sentences.ts` with its test, and the unused re-export
      `features/conversation/reading/SavedGlossText.tsx`;
    - `TurnView` props `revealed`, `onReveal`, `onToggleReveal`, `onPopup`,
      `onInspect`, `onHold`, `showRomanization`, `alwaysRomanize`,
      `alwaysPronunciation` and `autoTranslate`;
    - the unused `inspect` prop of `AnalysisContent` and `CoachAnalysisPanel`;
    - the `.popup-card/-roman/-x/-actions` and `.rtl-line` style rules left
      unused. `styles:dead` is back to its baseline 18 classes.
- **Reuse/complexity.** One message renderer instead of three: the TurnView
  bubble, `ReadingPassage` and `TokenSpan`. One difficulty definition instead of
  five: four native lists plus the UI list. `TurnView` went from 384 to 201
  lines; `TargetMessage` is 133. Across `src`: 477 lines added, 879 deleted.
  Newly necessary: the `layout` variant, because thread bubbles keep their
  actions inside the bubble and passages keep them beneath.
- **Behavior differences, all intentional and small:**
  1. When there are no meanings at all, passages render through `TargetText`
     (Chat's existing empty rendering) instead of an empty `SavedGlossText`.
  2. In passages, an explicit translation choice now survives a
     reading-preference change, as the Chat bubble already did.
  3. With aids on but no meanings yet, the bubble's Word by word shows as not
     pressed; before, it showed pressed with nothing to show.
  4. Word by word is disabled when there are no meanings and no lookup, as in
     the bubble.
  5. Toggle buttons carry both `aria-pressed` and `aria-expanded`, which keeps
     both earlier assertion styles.
- **Verification** (Linux clone at `7ebf53d5`):
  - `npm test`: 161 files, 1,079 passed. The baseline was 162 files and 1,086:
    the 10 `sentences` tests were removed and 3 `TargetMessage` tests added.
  - `tsc` clean. `npm run build`, `styles:check` and `contracts:check` pass.
  - `cargo fmt --check` passes; `cargo clippy --lib --tests -D warnings` passes.
  - `cargo test --lib`: 530 passed. The baseline was 528, plus the 2 difficulty
    tests.
  - Test edits:
    - 12 negative assertions on the removed callbacks were deleted from
      `TurnView.test.tsx` (`expect(input.onHold/onPopup/onInspect/onReveal/
      onToggleReveal).not.toHaveBeenCalled()`).
    - Two token-path tests were ported to the saved-gloss renderer with the same
      checks (pronunciation shown only with the preference; punctuation kept
      once).
    - `ReadingPreferences.display.test.tsx` no longer renders `TokenSpan` or
      `GlossPopup`. Its counts dropped by those components' share, and the
      popup assertions were removed.
    - One `ReplyHelp` selector changed from `.w` to `.target-text` (difference 1
      above).
  - Browser harness: `tools/reading-preview.html` gained a "Same message tools,
    non-conversation source (drill item)" section. It was driven headlessly:
    Translate, Word by word, Pronunciation and Speak all work, with no console
    errors. `tools/conversation-preview.html` Chat bubble renders and translates.
  - **Not verified:** the macOS app has not been run. The harness uses stub
    speech and analysis actions, so it proves presentation wiring and the shared
    reading lookup, **not** native aid execution; that is CP2 (E2).
- **Inspect:** in your checkout, `npm run dev`, then open
  `/tools/reading-preview.html` (scroll to "Same message tools…") and
  `/tools/conversation-preview.html`. In the app, check that the chat bubble's
  Translate, Word by word, Analysis and read-aloud work, and that reply-help
  cards and the Analysis dialog show passages as before.
- **Decisions/issues:**
  - Pre-existing, not changed: `CoachAnalysisPanel` still declares unused props
    `pinnedTurn`, `nativeLanguageName`, `showRomanization` and `rtl`.
  - The `.line` / `.w.holding` rules may be dead; `styles:dead` does not flag
    them, so they were left alone.
- **Review outcome:** pending.


### CP1 independent review (2026-09-22)

**Outcome: changes requested, limited to two shared-renderer correctness fixes
before CP2.** The shared target-message and difficulty extraction are sound in
scope. Chat consumes the new implementation, feature state does not leak into
TargetMessage, and the old overlapping renderer is removed. The native difficulty
formatter preserves the previous prompt construction. Source confirms the active
conversation projection sets both legacy token arrays to empty. This review does
not independently establish the separate conversation's deletion approval.

Findings:

1. **P2 — partial glosses suppress whole-passage lookup.** In
   `TargetMessage.tsx::toggleWords`, `known.length > 0` now prevents lookup. The
   saved-reading index can supply only some words, and the previous ReadingPassage
   requested whole-passage help when opened. Reproduction: render `Hola casa` with
   only `Hola → hello`, lookup enabled and aid preferences off; click Word by word.
   The lookup is never called and `casa → house` remains unavailable. Preserve the
   existing reading-service cache and distinguish partial saved annotations from
   a completed full-passage result; do not infer completeness from array length.
   Preserve Chat's `lookupWords=false` behavior and avoid duplicate requests.
2. **P2 — lookup state is not scoped to its source.** TargetMessage retains fetched
   segments/error/pending state across text or language-scope changes; cancellation
   runs only on unmount. `segmentsKey` keys the child renderer, not the request or
   its state. Reproduction: start lookup for `Hola casa`, rerender the same component
   with `Adios sol` and a different segmentsKey, then resolve the first request.
   The old gloss renders on the new text. Some old passage callers keyed by text
   mitigated this inherited weakness, but the extracted reusable capability needs
   an explicit safe identity boundary. Scope requests/results to source revision,
   text and language/variety/explanation scope; clear invalid state, abort obsolete
   requests and reject late completions. Test both pending and already-completed
   lookup transitions, including scope changes with identical text.

Independent verification: ran TargetMessage, TurnView and DifficultySelect tests
plus two temporary focused reproduction tests. **43 existing tests passed; both
review probes failed with the symptoms above.** Temporary probe file was removed
after the run; promote equivalent regression cases into the owned test suite with
the fixes. `git diff --check` passed. Did not rerun the full native/UI/build suite,
launch the macOS app or reproduce the other agent's browser inspection. Their
full-suite results remain reported evidence, not independently repeated evidence.

Next scope: fix these two cases in the shared owner, add regression coverage and
rerun affected checks. Report the corrected CP1 diff for a focused review before
starting CP2. No architectural replanning is requested. A macOS smoke check with
the learner remains outstanding and must not be represented as passing. CP2's
first aid extraction should retain the bounded CP2 review gate. No commit is
required to finish this review, and no commit or deployment is authorized here.

### CP1 correction handoff (2026-09-22)

- **Status:** ready for focused review. Scope: the two review findings only, fixed
  in the shared owner `ui/src/components/reading/TargetMessage.tsx`. No other
  file changed. Diff: `.drill-cp1/cp1-correction.patch` (untracked).
- **Fix 1 — partial meanings no longer suppress lookup.** Completeness is no
  longer inferred from `known.length`. `lookedUp` is true only when the existing
  reading-service cache (`peek`) holds a gloss result for this source, or this
  component's own lookup answered for it. Word by word therefore requests the
  whole passage when saved meanings are partial, and makes no second request once
  a result exists. With `lookupWords=false` (Chat's bubble) the reading scope is
  `null`, so no lookup is possible, as before.
- **Fix 2 — lookup state is scoped to its source.**
  - `sourceKey` is the reading scope (language, variety, explanation, explanation
    variety) plus the text.
  - The fetched result is stored with its `sourceKey` and used only while it
    matches.
  - A `sourceKey` change aborts the in-flight request and clears pending and
    error state.
  - A late completion is dropped because its controller is aborted.
  - `segmentsKey` still only remounts the word renderer.
- **Regression tests** (in `TargetMessage.test.tsx`; each fails on the CP1
  version and passes on the fix):
  1. `Hola casa` with only `Hola` saved, lookup allowed: one request, `house`
     appears, no repeat request on reopen.
  2. The same partial meanings with `lookupWords=false`: no request.
  3. A pending lookup and a text change: the signal is aborted, the control
     re-enables, and the late `hello` never renders on `Adiós`.
  4. A completed lookup and a text change: the old gloss is gone, and the new
     text gets its own request and result.
  5. Identical text across a variety change (spain → mexico → spain): the
     completed Spain result is hidden under Mexico, the Mexico request carries
     `variety:'mexico'`, and the pending Mexico request is aborted and its late
     result dropped on returning to Spain.
- **Verification** (Linux clone):
  - Before the fix, the five new tests ran against the CP1 component: 4 failed
    and 1 passed (the Chat no-lookup case, as expected).
  - After the fix: `TargetMessage.test.tsx` 10/10; full `npm test` 161 files,
    1,084 passed; `tsc`, `npm run build` and `styles:check` pass.
  - Native code is unchanged since CP1, so the native checks were not rerun.
  - **Not verified:** the macOS smoke check with the learner is still
    outstanding.
- **Review outcome:** pending.

### CP1 follow-up review and sign-off (2026-09-22)

**Outcome: CP1 accepted; proceed to the first bounded CP2 slice.** Both previous
review findings are resolved in the shared TargetMessage implementation. Partial
saved meanings no longer imply a complete lookup; fetched results are scoped to
text and reading context, obsolete requests are aborted and late results ignored.
Chat's no-lookup path remains intact. Regression coverage exercises partial meanings,
pending/completed text transitions and identical text across variety changes.

Independent verification in this checkout: TargetMessage, TurnView and
DifficultySelect suites **48/48 passed**; `git diff --check` passed. The implementing
agent reports the full UI/build/style checks passing; those broader checks were not
repeated during this focused review. Native code was unchanged by the correction.
The learner reports running the macOS smoke check successfully. That closes the
previously outstanding learner smoke check; it is user-reported verification, not
an independently observed session or evidence of future Drill/native functionality.

Next scope: proceed within CP2, keeping shared capture/inspection work bounded and
proving one aid end to end through the proposed shared execution boundary before
expanding it to remaining aids. Chat and a non-conversation source must consume the
same implementation. Preserve durable Chat behavior, transaction ownership,
admission/cancellation/recovery and diagnostics. Verify the identified accounting
and playback lifecycle changes explicitly. Return at the first-aid CP2 review gate
with the diff, verification and inspection steps; do not proceed directly to CP3.

This sign-off approves progression to the next review checkpoint. It does not
authorize a commit, push, release or deployment. Earlier pending/outstanding entries
are historical and superseded by this follow-up outcome.

### CP2 first-aid handoff (2026-09-22)

- **Status:** ready for review, **partial CP2**. The scope is the first aid,
  translation, through the agreed boundary. E3 (owner-neutral recording and
  transcription), E4 (log-mel) and the remaining aids (word meanings via the
  shared lifecycle, analysis, speech) are **not started**.
  Diff: `.drill-cp1/cp2a.patch` (untracked; 27 files against the CP1-accepted
  state).
- **Boundary decision (learner, 2026-09-22; resolves D10 for this slice).**
  - The turn engine was traced end to end. Dispatch, publication, recovery,
    connection invalidation, admission, the AI activity view and usage statistics
    all join through `operations.turn_id → turns → conversations`. Generalizing
    that owner would be the scheduler rewrite §8 warns against.
  - Instead, the aid **capability** (prompt, output schema, validation, model
    role, task temperature, structured-output contract) is single-owner code used
    by both lifecycles:
    - Chat's durable turn engine, which is unchanged;
    - the existing context-free explicit-request path `language/reading`, which
      already reused Chat's gloss capability.
  - Per D13, the two lifecycles stay separate adapters. Drill items will use the
    explicit path, with Drill owning durable results (CP3).
- **Changes.**
  - Shared capability, one owner each:
    - `conversations/translation.rs`: `ROLE` (the model role). `turn_plan.rs`
      both translation declarations now reference it.
    - `ai/transport/provider/payload.rs`: `structured_output(schema)`, the
      2048-token JSON-schema contract. `scheduler.rs` uses it instead of its
      inline literal.
    - `conversations/execution/mod.rs`: `TASK_TEMPERATURE`, used by
      `dispatch.rs`, `speech.rs` and reading translation.
  - Explicit path (`language/reading`):
    - `ReadingInput.speech: bool` became `aid: ReadingAid` (`word_gloss |
      speech | translation`); the generated contract was updated.
    - `Request` carries the routed `model`. Access validation still compares
      against the resolved base target.
    - `Request::dispatch` and `Request::translation_dispatch` build the request
      from `translation::prompt`/`schema` with the same captured shape (`target
      language`, `translation language`, `languageContext`) that turns capture.
    - The executor (`application/commands/reading.rs`) validates with
      `translation::validate`.
    - `ReadingResult.translation` was added; the receipt kind is
      `reading_translation` and records the routed `requestedModel`.
  - **Accounting (explicitly changed, not assumed):**
    - `statistics/mod.rs` now counts submitted reading requests (receipts with
      `dispatchedAt`) in the global and per-language totals: attempts, tokens and
      unknown usage. Partner-scoped totals exclude them, since no partner owns
      them.
    - This also fixes a **pre-existing gap**: explicit word-meaning and
      read-aloud requests were never counted before.
  - UI:
    - `ReadingHelp` keys its cache and request sharing by aid, scope and text.
      Word-meaning behavior is unchanged; translations are cached separately;
      speech through `lookup` throws explicitly.
    - `TargetMessage` offers Translate for a source without a supplied
      translation when the owner allows lookup, using the same `useSourceRequest`
      scoping as Word by word. That hook was extracted from the CP1 correction,
      so both aids share one source-scoped request implementation.
    - Chat's bubble (`lookupWords=false`) is unchanged: it shows Translate only
      for its durable translation.
    - Chat's passages (reply-help quotes, grammar quotes, analysis sentences
      without a translation) are the **first real non-conversation consumer**:
      Translate now works there through the shared contract.
- **Verification** (Linux clone):
  - `cargo test --lib`: 533 passed (CP1 530, plus 3 new).
  - `cargo clippy --lib --tests -D warnings`, `cargo fmt --check` and
    `contracts:check` pass.
  - `npm test`: 161 files, 1,088 passed (plus 4).
  - `tsc`, `npm run build` and `styles:check` pass.
  - New tests:
    1. `explicit_reading_translation_sends_the_same_request_as_a_translation_turn`:
       a real turn dispatch and a reading dispatch for the same source have
       identical messages, schema, model (fast), temperature, route, URL and
       credential.
    2. `translation_runs_the_conversation_translation_contract_and_is_counted`:
       HTTP end to end over the custom route. It checks the submitted payload, the
       result, a receipt without content, and that the global and language usage
       rise by 1 attempt and 21/4 tokens while partner totals stay unchanged.
    3. `unclear_translation_fails_with_a_receipt_and_still_counts_usage`: a
       `translation: null` reply fails with the shared validator's message, the
       receipt is `failed` with provider metadata, and usage is counted.
    4. `TargetMessage`: translation on request (one request, cached toggle); no
       lookup translation for Chat's owner; a failed request is shown and a late
       result from an earlier source is dropped.
    5. `ReadingHelp`: translations are cached separately from word meanings, and
       speech is refused through lookup.
  - Existing Chat assertions are all preserved. The only test edits are
    mechanical `speech:false|true` → `aid:'word_gloss'|'speech'`.
  - Headless harness: `tools/reading-preview.html` grammar quote → Translate
    shows the fixture translation, with no console errors.
  - **Not verified:** the macOS app with a real provider. Playback lifecycle is
    **unchanged** by this slice: no playback code was touched. Its coordination
    work belongs to the capture part of CP2 (E3/E7), still to do.
- **Inspect (macOS):**
  1. In a conversation, open **Help with this reply → Explain grammar**. Click
     **Translate** on a quoted phrase: a real translation should appear.
  2. Open **Analysis** on a partner reply. The chat bubble still translates as
     before, from its saved translation.
  3. Open the AI activity panel → **Reading request history** → Refresh. There
     should be a `reading_translation` receipt with `requestedModel` = your fast
     model and no source text.
  4. In Progress / usage, the global and language attempt counts should rise by
     one per translation; partner rows should not change.
- **Decisions/issues:**
  - Behavior change: reading requests now count in usage totals (previously
    uncounted).
  - Pre-existing difference kept (D13): explicit word-meaning requests use
    temperature 0.0, while Chat's gloss operations use 0.7. Unify when the
    word-meaning aid moves onto the shared lifecycle.
  - Pre-existing (D13): reading speech is limited to 256 characters and the
    ElevenLabs route, and differs from Chat's persona speech. It must be resolved
    before Drill reference audio (CP2 speech aid).
- **Review outcome:** pending.

### CP2 first-aid independent review (2026-09-22)

**Outcome: shared translation direction accepted; two bounded UI corrections
required before first-aid sign-off. CP2 remains partial.** Shared prompt/schema,
validator, role, temperature and structured-output contract are used by both
lifecycles. Keeping Chat's turn engine and the existing explicit request lifecycle
as adapters is acceptable for this slice; no scheduler rewrite is requested.
Usage queries explicitly include dispatched reading receipts globally and by
language, and exclude them from partner totals. Native parity/local-provider
success and validation-failure accounting tests pass independently.

Findings (both P2):

1. **Translate's first click does nothing with autoTranslate enabled.** In
   `TargetMessage.tsx::toggleTranslation`, `translationOpen` inherits the preference
   even when no translation exists. The first click sets the override false and
   returns without requesting anything. Reproduced with no supplied/cached
   translation, lookup enabled and `autoTranslate=true`: zero calls after clicking
   Translate once. Separate actual available/displayed content from default
   visibility intent. An explicit Translate click on missing content should request
   it and show the result in one click, regardless of the preference. Likewise,
   retrying after an error or requesting for a new source must not require a
   meaningless close/open cycle. Add tests for preference-on, source change and
   failure/retry. Do not fix this by starting paid requests automatically on mount.
2. **Partial cache coverage still suppresses Word by word lookup.** `lookedUp`
   accepts any `cachedResult.gloss`. Real `ReadingHelp.peek()` synthesizes results
   from saved/cached words and explicitly returns `coverage:'partial'` when some
   words are missing. Thus `Hola casa` with cached help only for `Hola` never
   requests help for `casa`. Reproduced with that exact peek response. Respect the
   existing coverage contract; distinguish a completed request from partial saved
   coverage and avoid uncontrolled repeated requests. Add a provider-integrated
   regression using ReadingHelp/SavedReadingProvider, as well as checking Chat's
   no-lookup path. This is a missed integration case in the previous CP1 correction
   and review, not a newly introduced cache behavior. The previous sign-off tested
   partial supplied segments without exercising the real peek contract.

Independent checks: 61 existing focused UI tests passed (TargetMessage,
ReadingHelp, TurnView); both temporary review probes failed with the symptoms above.
The probes were removed after recording their reproduction. `cargo test
--manifest-path native/Cargo.toml --lib reading`: **23 passed**, including request
parity and the local-provider accounting tests. The initial sandboxed run blocked
three localhost listeners; rerunning with the required permissions passed all 23.
`git diff --check` passed. No full-suite rerun or live-provider macOS check was
performed in this review. The learner's earlier CP1 smoke check does not verify
this new translation path.

Next scope: correct these UI cases in the shared owner, add the regression tests,
rerun affected checks and return for a short first-aid review. Then complete the
remaining CP2 work under its existing checkpoints. Mac inspection should include
one-click translation with automatic translation enabled, existing Chat translation
and the reading receipt. Preserve the documented outstanding shared speech and
playback work. No commit or deployment is authorized by this review.

### CP2 first-aid correction handoff (2026-09-22)

- **Status:** ready for a short follow-up review. Scope: the two review findings,
  fixed in the shared owner `ui/src/components/reading/TargetMessage.tsx`, plus
  regression tests. No native change. Diff: `.drill-cp1/cp2a-correction.patch`.
- **Fix 1 — one explicit click fetches a missing translation.**
  - With no translation available, Translate sets the translation open and
    requests it, whatever the automatic-translation preference.
  - With a translation available, Translate toggles it as before.
  - The pressed and expanded state now reflects what is visible
    (`translationShown`), so the preference no longer shows an empty "pressed"
    state.
  - Nothing is requested on mount.
  - Chat's bubble always has its durable translation when the button shows, so
    its behavior is unchanged.
- **Fix 2 — partial cached meanings no longer block lookup.**
  - `lookedUp` now requires `peek()` coverage `complete`, or this source's own
    lookup having answered.
  - For the same "missing content" reason as fix 1, Word by word with an
    incomplete lookup now requests the whole passage and shows it, even when a
    preference already shows the partial meanings; otherwise it toggles.
  - Request de-duplication stays in `ReadingHelp.lookup` (a complete cache is
    returned without a request, and in-flight requests are shared).
  - `lookupWords=false` still never requests.
- **Regression tests.** Five new; the first four fail against the pre-fix
  component and pass after the fix:
  1. `TargetMessage`: preference on, one click fetches and shows, `aria-pressed`
     is false before and true after, the next click hides, and there is no
     request on mount.
  2. `TargetMessage`: preference on, a source change hides the old translation
     and needs its own click and request.
  3. `TargetMessage`: preference on, a failure shows the error and is not
     pressed; one more click retries and shows the translation.
  4. `ReadingHelp` integration through the real provider: a durable
     `SavedReadingProvider` source covers only `Hola` of `Hola casa` (partial
     `peek`). One click makes exactly one `word_gloss` request, `house` appears,
     and further toggles make no new request.
  5. `ReadingHelp` integration: two passages with the same text. After one
     lookup, the second shows the complete cached meanings without a request;
     Chat-style owners (`lookupWords=false`) never request. This test also
     passes before the fix and guards de-duplication.
- **Verification:**
  - `npm test`: 161 files, 1,093 passed (was 1,088; plus 5).
  - `tsc`, `npm run build` and `styles:check` pass.
  - Native code is unchanged since the first-aid handoff (533 passed there).
- **Behavior note.** A failed word or translation request is retried by the next
  click on that button rather than toggling it closed. That follows fix 1's
  "one click fetches missing content".
- **Still outstanding:** the macOS smoke check of this slice:
  1. one-click translation with automatic translation on;
  2. existing Chat translation;
  3. the `reading_translation` receipt.
- **Review outcome:** pending.

### CP2 translation correction review and runtime error investigation (2026-09-22)

**Outcome: the two CP2a UI corrections pass code/test review. Live smoke verification
remains incomplete because the learner ran a stale native executable with the new
frontend.** Do not treat this as a completed CP2 milestone.

The corrected TargetMessage now requests missing translations on one click regardless
of the automatic-translation preference, and incomplete word meanings on one click
regardless of their current visibility. Complete cache coverage and a completed
source-specific lookup prevent duplicate requests. Tests cover preference-on,
source changes, failure/retry, actual ReadingHelp partial saved coverage, shared
cache reuse and Chat's no-lookup behavior.

#### Runtime mismatch: established cause

The user's exact error was reproduced in the durable diagnostic log: `begin_reading`
rejected unknown field `aid` and expected the old `speech` field. The active native
PID 93391 started at 10:45:23 EDT; both the debug executable and signed development
bundle executable were last built at 10:45:22 EDT. The current ReadingInput source
was modified at 11:13:42 EDT and declares `aid: ReadingAid`. Vite remains the
10:45 development server and can serve hot-updated frontend code independently.
This is a frontend/native contract mismatch, before the reading handler executes;
it is not a recognizer/provider refusal. Native library tests and generated-contract
checks do not rebuild or replace the running application binary.

Required runtime verification: stop the old development session and rerun
`npm run macos:dev`, which builds the native executable and signs/launches the
current bundle. Then verify token-tag reading, one-click passage translation with
automatic translation on, unchanged Chat translation and a reading_translation
receipt. Do not add a compatibility fallback to `speech`; both sides should use
the current generated contract. This review did not terminate/restart the learner's
app or make a paid provider request. Future handoffs must distinguish source/test
parity from verification of the actual running executable.

#### Redaction: exact finding and targeted fix

For this error, the diagnostic explanation was NOT lost. The top-level message in
both the UI report and durable log contains command, argument, unexpected field and
all expected field names. Tauri returned one plain error string; there was no separate
structured response/body hidden under `fields`. `errorDetails()` preserved the
string as message but fed its duplicate through the unclassified root-string path,
which replaced it with `[user content redacted]`. That is misleading and needlessly
redacts known diagnostic prose in the duplicate representation.

Fixed `ui/src/platform/diagnostics/error-details.ts` to normalize a string rejection
to `{message: error}` before metadata sanitization. The existing shared span scrubber
now handles both representations identically; no unknown-field allowlist expansion
or raw-response bypass was added. Two regression tests failed before the change
and pass after it: exact contract error survives in message and structured fields,
including a second diagnostic pass; secret assignments, labelled transcripts and
known private echoes are removed while the failure stage/expected shape survive.
This is a targeted verification of the reported path, not a claim that all possible
provider/error envelopes have been audited again.

Log coverage: read every JSON/JSONL stream and manifest present in all seven local
run directories, including successes. The current run is
`app-2026-09-22T14-45-05.426Z-a4d20ee4-43a2-4d9c-8ce9-54c0cf750dff`: diagnostics
(240 records), native (54), launcher (1), stdout (19), stderr (6), plus manifest.
Three diagnostics contain the exact contract mismatch. Six older native run
directories were also scanned. No malformed JSON was encountered. This did not
inspect remote server/mobile logs; this failure occurs before any provider request.

Independent checks: **99/99 tests passed** across TargetMessage, ReadingHelp,
TurnView, frontend diagnostics and reading IPC suites. TypeScript no-emit check
and `git diff --check` passed. No native source changed in this correction/review;
the preceding review independently passed 23 focused native reading tests.
Full UI/build results in the other agent's handoff were not rerun here.

Reviewer edits are limited to the diagnostic formatter, its two regression tests,
and this note; preserve them when continuing. All changes remain uncommitted.
Next: rebuild/relaunch the current native app and complete this slice's live smoke
check, then continue the remaining bounded CP2 work. No commit or deployment is
authorized by this review.

### CP2b handoff — the remaining shared aids (2026-09-22)

**Scope: word meanings, speech and grammar explanations now run the same
capability contracts as conversation turns, through the reading path (E2).
No capture (E3) or spectrogram (E4) work is in this slice. Uncommitted.**

#### What changed, and what it fixes

Word meanings. Explicit reading gloss previously diverged from Chat's gloss in
three ways: temperature 0.0 against Chat's 0.7, an unrouted model, and strict
validation where Chat recovers independently valid spans. All three now come
from the shared owners: `Request::word_gloss_dispatch()` builds the same
source-bound prompt and output schema at `execution::TASK_TEMPERATURE` on the
`gloss::ROLE`-routed model, and the command validates with
`gloss::recover_with_context`, the function Chat's publication uses. A rejected
span no longer discards the whole result; the content-free recovery report is
kept on the receipt at `response.wordGlossValidation`. The now-unused strict
`gloss::validate_with_context` and its adapter entry point are deleted rather
than left as a second path.

Speech. The reading-speech restrictions the CP2a handoff recorded as open are
resolved by sharing Chat's persona-speech contract instead of duplicating it:
`execution::speech_input` builds and validates the request (source limits, the
`{target} — {variety}` language label, route validation) and is called by both
`prepare_speech` and `Request::speech_input`. The 256-character limit is gone
(one reading limit, 2048 UTF-16 units, for every aid), and so is the OpenRouter
refusal — Chat's speech already runs on that route through the same
`ai::audio::validate_speech`/`synthesize` pair. The single supported voice is one
constant, `configuration::SPEECH_VOICE`.

Grammar explanations. New aid `ReadingAid::Explanations`, receipt kind
`reading_explanations`. It sends the conversation-support instruction built by
`conversation_support::prompt_for_exchange` (already a pure projection), the
`schema_for_context` output schema, the task temperature and
`conversation_support::ROLE`. `validate()` is split so both engines validate
through `validate_source(source, kind, output)`; only the source lookup stayed
turn-bound. The explained text carries no surrounding exchange, so
`precedingExchange` is empty and `latestLearnerInput` is null — the contract is
shared, the context is what the source has.

Model roles are no longer literals at the plan: `turn_plan` declares them through
`gloss::ROLE`, `execution::SPEECH_ROLE`, `translation::ROLE` and
`conversation_support::ROLE`, which is what the reading path routes on
(`ReadingAid::role()`), so the two engines cannot drift apart silently.

UI: `ReadingHelp`'s one cache and request-sharing map now recognizes a satisfied
`explanations` result per aid, scope and text. No new UI surface — the analysis
cards renderer in `AnalysisContent` is still conversation-bound and is extracted
in CP3, when Drill first renders it, rather than speculatively here.

#### Files

`native/src/`: `conversations/gloss.rs`, `conversations/turn_plan.rs`,
`conversations/execution/{mod,speech}.rs`,
`learning/coaching/conversation_support.rs`, `language/reading/mod.rs`,
`language/linguistics/adapter.rs`, `configuration/mod.rs`,
`application/commands/reading.rs`, plus tests in
`application/tests/reading.rs` and
`conversations/execution/tests/{reading_gloss,speech_requests,reply_help}.rs`.
`ui/src/`: `components/reading/ReadingHelp.tsx` (+ its test),
`generated/contracts.ts`. Patch: `.drill-cp1/cp2b.patch`.

#### Verification (automated)

`cargo test --lib` 540 passed, 0 failed, 6 ignored. `cargo clippy --lib --tests
-- -D warnings` and `cargo fmt -- --check` clean. `npm test` 1096 passed,
`npm run build`, `npm run styles:check`, `npm run contracts:check`,
`npx tsc --noEmit` and `git diff --check` all clean.

New tests, each failing before its change:

- `explicit_reading_gloss_sends_the_same_request_as_a_word_gloss_turn`: same
  messages, output schema, routed model, task temperature and access as the turn
  dispatch, and the same partial-coverage result from the same reply.
- `word_gloss_runs_the_conversation_gloss_contract_and_keeps_partial_meanings`:
  end to end over the custom route — prompt, schema, model and temperature on the
  wire, a partial result kept instead of an error, the recovery policy on the
  receipt, no source text in it, and usage counted once.
- `explicit_reading_speech_sends_the_same_request_as_persona_speech`: identical
  text, voice, language label, model and access on the OpenRouter route the old
  code refused, and a sentence well over the old 256-unit limit accepted.
- `explicit_reading_explanations_use_the_explanation_turn_contract`: identical
  system instruction, output schema, model, temperature and access; the explained
  text present with an empty exchange; and `validate_source` accepting a verbatim
  quote and rejecting one absent from the source, with the turn engine rejecting
  the same bad card.
- `explanations_run_the_conversation_support_contract_against_the_source`: end to
  end, with the receipt kind, redaction and usage counted.
- `caches grammar explanations per aid, scope and source, and reuses them`
  (`ReadingHelp`).

#### Inspection steps (macOS, after `npm run macos:dev` rebuilds the native binary)

1. Word by word on a partner message whose meanings come back incomplete: the
   valid parts are shown instead of the whole request failing, and the reading
   request history shows `reading_gloss` with `wordGlossValidation`.
2. Read-aloud on a whole selected sentence (not just a token), on the OpenRouter
   route: it plays, where it previously refused with the ElevenLabs message.
3. Chat is unchanged: word meanings, translation, read-aloud and Analysis on a
   partner message behave as before.

#### Not done here, and known state

- E3 (owner-neutral capture/transcription, the `statistics/mod.rs:15` join) and
  E4 (log-mel spectrogram and the shared canvas) are the remaining CP2 work.
- Reading explanations have no UI surface yet; the cards renderer extraction is
  CP3 work, with Drill as its second consumer.
- `npm run styles:dead` reports `tok`, `trans-d` and `saved-word-part*` among 19
  unused classes. Verified present at `HEAD` with no consumers there either, so
  they predate this work; left alone rather than mixed into this diff.
- No commit or deployment. Reviewer-owned `error-details.ts` changes, their tests
  and the preceding plan notes were synced from the device before editing and are
  preserved byte for byte.

### CP2b correction handoff (2026-09-22)

**Both review findings fixed. Uncommitted; no commit or deployment authorized.**

#### 1. Repeat requests for unresolved word meanings

Confirmed and fixed. `WordHoverHelp`'s lookup effect depended on `localParts`
and on `lookup`, both of which change identity whenever the shared reading cache
revises. A recovered partial result that left the hovered word unresolved
therefore re-entered the effect, found no local parts, and asked again — and any
unrelated write to the same cache did the same while the card was open.

The request is now bound to an explicit opening or retry: one request per
`[scope, text, attempt]` key, guarded by a ref, with saved and cached meanings
read once at that moment through a ref rather than as effect dependencies. The
in-flight controller is aborted on unmount only, not on a dependency change, so
a cache revision can no longer cancel a live request and then be blocked from
reissuing it. Valid partial meanings still render for the words they cover, and
`Retry word meanings` still appears when nothing covers the selected word;
each click makes exactly one further request. The strict validator was not
restored — recovery still keeps whatever spans were valid.

Tests (`ReadingHelp.test.tsx`, both failing before the change):
`asks once when a word stays unresolved, and once more per explicit retry`
(one call from the opening, none from the result's own cache write, one per
retry) and `keeps a partial meaning for the word it covers and does not re-ask
after unrelated cache updates` (an unresolved word's card open while a
translation lookup writes the cache; the covered word still shows its meaning).

#### 2. Dropped speech transcript-comparison diagnostics

Confirmed and fixed. The durable persona-speech event and the reading receipt
were building their own field sets, and only the event carried
`transcriptComparison`. The content-free projection is now one function,
`diagnostics::speech::outcome_metadata`: audio accepted, normalized finish
reason, usage, and the provider's transcript comparison. `event()` merges it,
and the reading command merges it into the receipt metadata before the audio
result is consumed, so it is retained on success and on failure alike. Reading
receipts keep their own `actualModel`, `providerId`, `costMicros` and provider
diagnostics on top of it; the event still omits those deliberately.

Tests: `shared_outcome_metadata_keeps_the_comparison_without_its_content`
(comparison counts survive for failed and accepted audio, absent comparison is
explicitly null rather than omitted, and no source text, transcript or audio
appears) and, in the reading command test, the receipt now asserts
`audioAccepted`, a present `finishReason` and a present `transcriptComparison`.
That route reports no comparison, so the receipt's value is explicitly null
there; retention of a real comparison is covered by the projection's own test.
This was omitted metadata, not over-redaction: nothing was un-redacted.

#### Handoff correction, inspection steps

The CP2b inspection step for word meanings named the partner bubble, which runs
the turn gloss and does not exercise `reading_gloss`. Use explicit reading help
instead: tap a word in text that has no saved meanings (an analysis passage or
reading example) to get the word-help card, or use `Word by word` on such a
passage. That is the `begin_reading` path this slice changed. Expect: one
request per opening, valid partial meanings shown, one further request per
`Retry word meanings`, and `reading_gloss` with `wordGlossValidation` in the
reading request history. Steps 2 (whole-sentence read-aloud on OpenRouter) and
3 (Chat unchanged) stand as written.

Also correcting the CP2b handoff's own figure: native `cargo test --lib` was
**538** passed at that point, not 540.

#### Verification (automated, this correction)

`cargo test --lib` 539 passed, 0 failed, 6 ignored. `cargo clippy --lib --tests
-- -D warnings` and `cargo fmt -- --check` clean. `npm test` 1098 passed across
161 files, `npm run build`, `npm run styles:check`, `npm run contracts:check`,
`npx tsc --noEmit` and `git diff --check` clean. Patch: `.drill-cp1/cp2b.patch`
(regenerated to include this correction).

E3 and E4 remain the outstanding CP2 work; neither is started.

### CP2b source-change correction (2026-09-22)

**Fixed. Uncommitted; no commit or deployment authorized.**

The reviewer is right: aborting only on unmount meant a result could outlive the
question it answered. `WordHoverHelp` is not remounted when its source changes
(`ReadingWord` keys on the word's start offset), so opening help for one word,
changing the text or the language scope, and then resolving the first lookup
delivered that answer to the new source's card.

Requests are now stable across cache updates and invalidated on source change.
The request key is `[scope, text, attempt]`: when it changes — a new text, a new
language or variety, or an explicit retry — the pending controller is aborted,
`result` and `failure` are cleared, and a fresh request is made for the new
source. A late result or error is accepted only while its own controller is
still the current one, so neither can reach a card that has moved on. Cache
revisions still do not change the key, so the no-repeat behaviour is unchanged.

Tests (`ReadingHelp.test.tsx`, both failing against the previous unmount-only
version, both passing now):

- `drops a pending result when the source text changes and asks for the new
  source`: help opens for one word, the text changes, the first lookup then
  resolves; the card shows no stale meaning and stays in its loading state until
  the new source's own result arrives.
- `drops a pending result when the language scope changes and asks in the new
  scope`: the same with a variety change, and the abandoned request is *rejected*
  rather than resolved — no stale error reaches the new scope's card either.

The four existing reading-help tests for no-repeat behaviour, partial meanings
and explicit retry are unchanged and still pass.

Verification: `npm test` 1100 passed across 161 files; `npx tsc --noEmit`,
`npm run build`, `npm run styles:check` and `git diff --check` clean. No native
source changed in this correction, so the native suite is unchanged from the
previous entry (539 passed). Patch regenerated at `.drill-cp1/cp2b.patch`.
E3 and E4 remain the outstanding CP2 work.


### CP2b follow-up sign-off — 2026-09-22

**Source review approved. Proceed to E3; CP2 as a whole remains incomplete.**

Reviewed the current WordHoverHelp lifecycle: changes to scope/text/attempt
abort the previous controller, clear completed result/error state, and guard
promise publication by the current controller. Cache revisions do not restart
the request. The text-change success and variety-change failure regressions
exercise the real ReadingHelp provider. Reviewer reran ReadingHelp.test.tsx
and TargetMessage.test.tsx: all 35 tests passed. No further blocking finding
in this correction. The earlier speech-diagnostics approval stands.

This is source and focused automated verification, not a new live macOS test;
the executor's full-suite counts are reported separately above.

Next bounded checkpoint: E3, one shared capture/transcription implementation
used by Chat and a validated non-conversation owner. Preserve one capture slot,
cancellation and ownership checks, provider execution and useful redacted
receipts. Verify global/language usage once, no invented partner attribution,
and failure/unknown-usage handling. Demonstrate native recording and Chat
regression behavior, then check in for review before E4.

E4 follows as a separate checkpoint: one shared log-mel analysis and canvas,
with Chat consuming the improvement immediately. Document numerical parameters
and verify sample-rate/Nyquist behavior, silence and known-frequency fixtures;
show the Chat result and paired rendering with consistent axes/colour scale
for visual review. Do not start automatic segmentation or expand into CP3 in
these slices. Reuse existing playback/capture coordination. No commit or
deployment is authorized by this sign-off.

### E3 handoff — owner-neutral recording and transcription (2026-09-22)

**One capture and transcription implementation, used by Chat and by a validated
drill-item owner. Uncommitted.**

#### What changed

`RecordingOwner` (`speech/recording/owner.rs`) is `Conversation{id}` or
`DrillItem{id}`, and it is the only thing a caller names. Everything else is
resolved natively from the owner's own record: `owner.scope(&store)` returns the
recognizer language, variety and language tag, plus the recognizer context — the
last partner message for a conversation, the line being repeated for a drill
item. IPC no longer carries a language, a variety or a context to trust, and
`mic_start` takes `owner` instead of `conversationId`.

`transcription::{permitted, begin, finish, views}` and the three `Store` methods
now take that owner. `permitted()` validates each kind with its own query — a
conversation must be unarchived with an unarchived contact, a drill item must
exist and be unarchived — and the connection check is unchanged. Receipts carry
`conversation_id` / `drill_item_id`, exactly one set, enforced by a table CHECK
and by `owner.columns()`; every update matches on both columns, so a receipt
cannot be finished, re-diagnosed or listed through the wrong owner. Both columns
cascade on delete.

Schema is version 29: `drill_items` (language, variety, explanation pair, text,
archived) and the two owner columns with their CHECK and indexes. `drill_items`
is deliberately the minimum E3 needs to validate an owner and attribute its
language; sets, sessions, visits and attempts arrive with Drill itself (§5.1).

The statistics query (the old `statistics/mod.rs:15` join through conversations
and contacts) now left-joins both owners: a recording counts once toward global
and language totals through `COALESCE(c.language_id, d.language_id)`, and a
partner-scoped report matches on `r.persona_id`, which a drill recording never
has — so no partner attribution is invented. Unknown usage is unchanged: a
transcription reports no tokens, so each one still counts as unknown.

`AudioInspection.conversation_id` became `AudioInspection.owner`, and
`inspect_wav` takes the owner. `useMicRecorder` takes `owner` instead of
`conversationId`, keys its effects on the owner identity, sends it to
`mic_start`, and rejects a result whose inspection names a different recording
**or** a different owner (kind as well as id). `ConversationPage` passes
`{kind:'conversation', id}`; nothing else in Chat changed.

The single capture slot, cancellation, admission, holds, pause checks, retry,
refusal recording and redacted diagnostics are the existing implementations,
unchanged — Drill will use them by naming a different owner.

#### Verification (automated)

`cargo test --lib` 544 passed, 0 failed, 6 ignored (5 new). Clippy `-D warnings`,
`cargo fmt --check`, `npm test` 1101 passed across 161 files, `npm run build`,
`npm run styles:check`, `npm run contracts:check`, `npx tsc --noEmit` and
`git diff --check` all clean.

New native tests:

- `a_drill_item_supplies_its_own_language_and_the_line_being_repeated`: the item
  resolves the same language tag and variety as the conversation, its context is
  the item text, a conversation with no partner message has no context, and an
  unknown owner resolves to nothing.
- `both_owners_record_through_the_same_receipts_and_stay_separate`: both owners
  begin and finish through the same code, each sees only its own receipt, no
  transcript text is retained, and finishing a drill receipt through the
  conversation owner fails and leaves it running.
- `drill_usage_counts_once_for_the_language_and_never_for_a_partner`: +2 global
  and +2 language attempts and unknown usage, +1 for the partner; deleting the
  item drops its receipt and its usage and leaves the conversation's intact.
- `an_archived_item_stops_publication_with_an_unknown_outcome`: a late result on
  an archived item is `UnknownOutcome` (it may already have cost money), the
  receipt is `unknown`, and no new recording can start for it.
- `an_unknown_owner_is_refused_before_the_microphone_opens` (application-level,
  owning the capture slot): both owner kinds are refused during validation and
  the slot is left unclaimed.

New UI coverage: `useMicRecorder` starts with `{ owner }`, and the
result-rejection test now covers a wrong recording id, a wrong owner id and a
wrong owner kind.

Not verified here: a live recording on macOS, and a drill recording through the
UI — Drill has no surface until CP3, so the drill owner is exercised natively.

#### Next inspection (macOS)

1. **This build needs a Factory Reset first.** Schema 29 does not match an existing
   workspace's version, and the store refuses to open a mismatched workspace
   with "Use Factory Reset to start a new workspace" rather than migrating. Dev
   data is disposable per AGENTS.md; reset, then set up a chat again.
2. Record in Chat and stop: the transcript arrives as before, the level meter
   runs, `Inspect recording` opens, and a second recording cannot start while one
   is running.
3. Check Statistics: the recording counts once in global and in the language
   totals, and once for that partner.

#### Not in this slice

E4 (shared log-mel analysis and canvas) is next, as its own checkpoint.
Automatic segmentation (E7) and everything CP3 owns stay out. `drill_items` has
no command and no UI: nothing creates one outside tests yet.


### E3 reviewer checkpoint — 2026-09-22

**Source review approved; proceed to E4. Live macOS recording remains unverified.**

Reviewed native owner resolution, capture/transcription dispatch, owner-bound
receipt updates, schema constraints, statistics joins and UI result ownership.
No blocking finding in this slice. Both owner kinds use the existing execution
path and capture slot. Receipt publication matches both owner columns; Drill
usage joins its language without a partner attribution. Unknown transcription
usage remains unknown. The minimal drill item table has no production creation
command yet, as explicitly deferred to CP3.

Reviewer verification: 11 speech::recording tests, 1 application capture test,
and 19 recorder/inspection UI tests passed. These verify scope/receipt/accounting
and UI lifecycle behavior; they do not demonstrate a real microphone capture
for a Drill item. The capture test proves rejection before opening hardware for
unknown owners, not a hardware concurrency test. Full-suite counts above are
executor-reported. No app data was reset during this review.

Proceed with E4 as the last planned CP2 extraction: shared log-mel analysis and
canvas, adopted by Chat immediately, numerical fixtures plus a visual paired
inspection demonstration with consistent axes and colour scale. Preserve
sample-rate/Nyquist handling and explicit analysis parameters. Return at that
checkpoint, then move to CP3 rather than adding an unrelated architecture pass.

Before Drill consumes the recorder hook, relocate useMicRecorder and its tests
from features/conversation/speech to the shared platform/audio owner, updating
Chat imports without a compatibility re-export or duplicate hook. This is a
small ownership move, not a blocker for starting E4.

CP3 must establish source edit/revision semantics before allowing mutable Drill
items with recordings in flight, and distinguish reference checks from learner
attempts when reference transcription is introduced. Neither has a production
caller in this slice; do not present them as implemented by the owner enum.
The E3 Mac check still requires schema-29 workspace reset, a rebuilt app, Chat
record/stop/inspection and verification of usage deltas. No commit/deployment.

### E4 handoff — shared log-mel analysis and canvas (2026-09-22)

**One mel analysis and one canvas; Chat uses both now. Uncommitted.**

#### The analysis

`spectrogram()` keeps its STFT (Hann window, 25 ms rounded up to a power of two,
50% hop, one-sided power normalized by the squared window sum) and replaces the
linear 129-bucket axis with a mel filterbank. Parameters, all reported with
every result so a reader never has to guess:

- 64 triangular bands, 50 Hz to 8 kHz, **or Nyquist when the recording cannot
  carry 8 kHz** — an 8 kHz capture is analysed to 4 kHz rather than padded with
  empty bands.
- Mel scale `2595 * log10(1 + hz / 700)` (HTK), reported as `melScale`.
- Unit-peak triangles, each starting at the previous band's centre, reported as
  `normalization`; adjacent filters overlap by half a band so the range is
  covered.
- dB is `10 * log10(power)` clamped to [-100, 0], reported as `dbReference`
  ("0 dB = full-scale power").
- `bands[]` carries every filter's low/centre/high in Hz, so the UI axis is the
  analysis's own numbers, and `minFrequencyHz` joins `maxFrequencyHz`.

Why: speech detail lives in the lowest couple of kHz. On the old linear axis
most rows described 2–8 kHz; more than half the mel bands now sit below 2 kHz,
which is what makes two attempts comparable by eye.

#### The canvas

`components/media/Spectrogram.tsx` owns the painting, extracted from
`TranscriptionInspector`. It adds what pairing needs: an optional `scale`
(`sharedScale()` returns the widest dB window across several analyses, so the
same colour means the same level in every panel) and
`SpectrogramFrequencyScale`, the mel axis drawn from `bands[]`.

Chat adopted both immediately. It also gains a *visible* frequency axis: the
inspector's frequency labels were inside `.inspection-row > h3 span`, which the
stylesheet sets to `display: none`, so Chat has never shown one. The new
`.inspection-frequency-scale` renders over the canvas's trailing edge. The
inspector's detection details now report the band count, range, mel scale,
filter normalization and dB reference instead of a linear "frequency
resolution".

`useMicRecorder` and its test moved from `features/conversation/speech/` to
`platform/audio/`, per the review; Chat's imports updated, no re-export left
behind.

#### Visual demonstration

`ui/tools/spectrogram-preview.{html,tsx}` renders a reference and an attempt
side by side through the production canvas, on one mel axis and one shared dB
scale, plus a button that opens Chat's own inspector over the same analysis.
Its data is `ui/tools/spectrogram-fixture.json`, produced by the native
analysis: the test `paired_inspection_fixture_matches_the_current_analysis`
regenerates it under `SKELLYSPEAK_UPDATE_FIXTURES=1` and otherwise fails if the
committed fixture no longer matches what the analysis produces, so the picture
cannot go stale. (A native test writing a UI fixture crosses a layer; it is one
file, guarded, and the alternative was widening `speech::recording` and
`inspect_wav` to `pub` for a demo binary. Flagging it for the reviewer.)

Screenshots taken from that page in light and dark: the reference's three tones
sit visibly higher and earlier than the attempt's lower, later, longer ones;
both panels carry identical axis labels and legend. Shared with the learner in
the session.

#### Verification (automated)

`cargo test --lib` 548 passed, 0 failed, 6 ignored (4 new). `npm test` 1104
passed across 162 files (3 new). Clippy `-D warnings`, `cargo fmt --check`,
`npm run build`, `npm run contracts:check`, `npm run styles:check`,
`npm run previews:check`, `tools/check-languages.ts` (1103 messages × 7
locales), `npx tsc --noEmit` and `git diff --check` all clean.

New native tests: `mel_bands_are_ordered_overlapping_and_stop_at_the_analysed_ceiling`
(ordering, half-band overlap, the 4 kHz/8 kHz ceilings, HTK round-tripping, and
that most bands sit below 2 kHz), `silence_sits_at_the_floor_and_a_tone_lifts_only_its_own_band`
(digital silence reads -100 dB; a 1 kHz tone peaks in the band containing it and
leaves every distant band 30 dB below; halving the amplitude costs 6.02 dB),
`the_reported_parameters_describe_the_numbers_that_were_produced`, and the
fixture guard. The two existing rate tests now assert the peak falls inside its
band's edges at 8/16/44.1/48/192 kHz and that the ceiling follows Nyquist.
New UI tests cover `sharedScale`, `melAxisTicks`, the axis order and the
canvas's accessible name and unavailable path.

Two preview files were already broken at `HEAD` by CP1's prop removals
(`jev-rewards-preview`, `reading-analysis-fixture`); `previews:check` is not in
the plan's check list, which is why it went unnoticed. Both are fixed, and that
check is now part of this work's routine.

#### Next inspection (macOS)

The outstanding E3 check still applies and now covers E4 as well: Factory Reset
for schema 29, rebuild with `npm run macos:dev`, record in Chat, stop, open
`Inspect recording`. Expect a mel spectrogram with a visible frequency axis
(≈79–7678 Hz labels), voice energy concentrated in the lower bands, and the new
analysis parameters under `Detection details`. Then check Statistics for the
usage deltas E3 describes.

Not verified: a live macOS recording, and anything Drill-side — CP3 is next.

### Learner decision — segmentation markers on the attempt spectrogram (2026-09-22)

The reference panel is always **one** recording of the target phrase. The
learner's panel may hold **several utterances in one recording** (hands-free and
tap-auto capture). The paired view must therefore show where that recording was
split, not just its spectrum:

- A vertical boundary line at each split point, drawn on the attempt panel only,
  over the same time axis as the canvas.
- The silence rule that produced those splits, shown as a number with its
  method: the activity threshold in dBFS, the measured noise floor, and the
  pause length required to end an utterance. These are measurements, never
  scores (§5.2), and the threshold shown is the one that was actually applied.
- When a boundary came from something other than silence — a policy maximum
  utterance length, a stop control, or queue suspension — it is marked as that
  reason instead of being shown as a detected pause.

The data already exists: `InspectionActivity` carries `regions`, `pauses`,
`noiseFloorDbfs`, `thresholdDbfs`, `algorithm` and `limitations`, and the
Chat inspector already draws the activity band from it. What is missing is the
segmentation itself (E7) and an overlay on the shared canvas.

Ownership: the marker overlay is an optional layer on
`components/media/Spectrogram.tsx`, fed by the owner's segmentation result, so
Chat's single-utterance inspector renders without it and Drill passes
boundaries. Implement it with the Drill attempt view; the boundaries only become
real in Milestone C (E7 segmentation), so a single-utterance attempt shows no
lines and still shows the threshold it was captured under.

### E4 correction — one frequency grid for every recording (2026-09-22)

**Fixed. Uncommitted.**

The review is right, and it matters in practice rather than in theory: reference
audio arrives from the speech provider at its own rate and the learner's attempt
at whatever the microphone gives, so paired panels will routinely have different
sample rates. The band grid was derived from each recording's own ceiling, so 64
bands spanned 50 Hz–8 kHz for a 16 kHz capture and 50 Hz–4 kHz for an 8 kHz one:
the same tone drew at different heights, which defeats the comparison. The
same-rate preview hid it.

Now the grid is fixed — the same 64 bands over 50 Hz–8 kHz for every recording —
so row N is the same frequency in every panel. What a recording cannot carry is
reported as **unavailable**, not as silence: bands whose whole triangle sits
above Nyquist are `null` in `bins`, and the canvas paints them in their own
token (`--spectrogram-unavailable`) rather than the low-intensity colour. A band
only half below Nyquist counts as unavailable too, since a partly covered filter
would understate its own energy. `maxFrequencyHz` is the grid ceiling and the
new `measuredMaxFrequencyHz` is what this recording could reach; the canvas's
accessible name and the inspector's detection details both state it when they
differ.

Shared spectrogram styles moved out of the conversation stylesheet into
`ui/src/styles/components/spectrogram.css` (canvas, plot surface, mel axis and
the narrow-screen height), registered in the manifest before the conversation
sheet so cascade order is unchanged. Nothing was duplicated.

Verification: `cargo test --lib` 549 passed (2 new), `npm test` 1105 passed
across 162 files (1 new), plus clippy, fmt, build, contracts, styles, previews,
languages and `git diff --check`. New tests:
`every_recording_shares_one_band_grid_and_marks_what_it_cannot_measure` (the
grid is identical at 8/16/48 kHz, `measuredMaxFrequencyHz` follows Nyquist, and
each band is available exactly when it is fully below it) and
`the_same_tone_lands_in_the_same_band_whatever_the_capture_rate` (a 1 kHz tone
at 8/16/44.1/48 kHz peaks in the same row, with identical band grids) — the
regression the review asked for. A UI test covers the null rendering path and
the label that names the measured ceiling.

The preview fixture is now deliberately mixed-rate: a 16 kHz reference against
an 8 kHz attempt. The screenshot shows the attempt's unavailable region above
4 kHz in its own colour while both panels keep identical axis labels and tone
heights.

Also renamed the canvas's local colour helper from `rgb` to `channels`: the
style checker's literal-colour rule matches `rgb(`, so calling it directly
tripped a false positive.

CP3 starts next.

### CP3 handoff — the manual Drill experience (2026-09-22)

**Type a phrase, hear it, say it, see how close you were, replay it, delete it.
Uncommitted. Automatic capture and generated sets are not in this slice.**

#### What Drill owns, and what it borrows

New, in `native/src/drill/`: the item, the attempt and the comparison. Nothing
else. Recording, transcription, receipts, usage accounting, reading aids,
speech, audio inspection and the spectrogram are the same implementations Chat
uses, reached by naming a `RecordingOwner::DrillItem`.

**2026-09-23 implemented correction:** new comparisons use `drill-comparison-v2`.
Matching uses canonical decomposition, removal of all Unicode Mark-category
characters, and canonical recomposition, for every language. The normalization
receipt records `strip_unicode_marks`; punctuation uses Unicode properties rather
than script-specific ranges. Original target/transcript text remains unchanged.
This deliberately lossy base-text score does not assess spelling or pronunciation;
marks carrying phonemic meaning are ignored too. Base-letter differences remain.
No language identifiers, mark ranges or configuration overrides drive this rule.
The reported marked/unmarked phrase now scores 100% in the regression test.
Previously saved comparisons retain their recorded score; no attempts are rewritten.

The following describes the historical first slice; its diacritic and punctuation
rules are superseded by the shared correction above.

`drill/comparison.rs` measures one attempt against its target, policy
`drill-comparison-v1`:

- **Normalization** is composition (NFC), case folding and punctuation only,
  and every step applied is recorded with the result. Diacritics are *not*
  folded — a match must not claim a distinction that was never compared.
  Punctuation is dropped because recognizers do not report it reliably; a
  missing full stop is not something the learner failed to say.
- **Text match** is grapheme-cluster edit distance with an explicit reference
  denominator. `characterErrorRate` and `matchRatio` are null when the target
  has no graphemes — unmeasurable, never a perfect score. An empty transcript
  against a real target scores zero, which is a measurement.
- **Alignment** is deterministic, substitution-weighted by grapheme similarity,
  and every word is `same`, `substituted{similarity}`, `missing` or `extra`.
  A language without word spaces aligns as one unit and is carried by the
  character rate.
- **Script** is an advisory note (`matches`/`mismatch`/`unknown`) that changes
  no number, per §5.2's "no script-derived other_language verdict".

Storage: schema 30 adds `drill_attempts` (transcript, comparison JSON, the
`transcription_attempt_id` receipt, audio bytes and a prune timestamp), keyed to
`drill_items` with cascade. Attempt audio is a file beside the workspace
database, written before the row so an attempt never points at audio that is not
there; a disk-full write is an explicit failure. Deleting an item removes its
attempts, their audio files and their provider receipts, and its usage leaves
the statistics with them.

Commands: `create_drill_item`, `get_drill_items`, `delete_drill_item`,
`save_drill_attempt`, `get_drill_attempt_audio`, and `inspect_drill_audio` —
local analysis of audio belonging to an item, used for the reference panel and
for a replayed attempt, so both sides of a comparison come from one analysis.

UI, in `features/drill/`: `DrillPage` (phrase entry, phrase list, the target
card, reference playback, the recorder) and `AttemptLog` (the measured
comparison, word-by-word outcomes, replay, paired spectrograms). The target card
is `TargetMessage` with its shared tools; the recorder is `useMicRecorder` with
a drill owner; the spectrograms are the E4 canvas with `sharedScale`; playback
goes through the same exclusive authority as Chat's. Navigation gains
`practiceView: 'chat' | 'drill'`, and the Chat/Drill switch in the top bar
replaces the whole surface, as agreed.

`speakSelection` now returns the whole reading result rather than just its
receipt, so Drill can look at the reference audio it just played instead of
fetching it twice. Reading tools still show only the receipt.

#### Verification (automated)

`cargo test --lib` 562 passed, 0 failed, 6 ignored (13 new). `npm test` 1110
passed across 163 files (5 new). Clippy `-D warnings`, `cargo fmt --check`,
`npm run build`, `contracts:check`, `styles:check`, `previews:check`,
`check-languages` (1139 messages × 7 locales), `tsc --noEmit` and
`git diff --check` all clean.

Native tests cover: an exact repeat and what it normalized; diacritics measured
rather than folded; graphemes counted as a reader counts them (Devanagari,
flag emoji); all four word outcomes with a near-miss staying one word; RTL and
CJK alignment; both empty sides; the advisory script note; determinism and what
is stored. Store tests cover: a typed phrase becoming an item that resolves its
own recording scope; an attempt keeping transcript, comparison and audio, with
sequence order; attempts surviving a workspace reopen (which is what leaving and
re-entering Drill does) and deletion removing rows, audio and receipts; and a
drill recording counting once for its language and never for a partner.

UI tests drive the whole flow against a mocked native side: type a phrase →
record → `mic_start` with `{kind:'drillItem'}` → attempt saved with its
recording id and audio → score shown; the comparison detail with measurements,
normalizations and word outcomes, plus replay; the reference paired with the
attempt after it is heard; a pruned attempt saying so with replay disabled; and
attempts surviving a leave/return with deletion clearing the page.

#### Next inspection (macOS)

Factory Reset is needed again — this is schema 30. Then: Drill in the top bar →
type a phrase → **Hear it** (reference plays) → **Record**, say it, **Stop** →
the attempt appears with a match percentage → open it for the word-by-word
comparison, **Replay**, and the paired spectrograms on one axis and scale →
switch to Chat and back, and reopen the app, to see the attempt still there →
**Delete** to remove the phrase, its attempts and its audio. Statistics should
count each recording once globally and for the language, never for a partner.

#### Known gaps for the next slices

- Only own-phrase items: generated, conversation and skill-map sources are D-work.
- One attempt per explicit Stop; hands-free and tap-auto are Milestone C (E7),
  as are the segmentation markers and silence threshold the learner asked for.
- No retention cap yet: audio is kept until its item is deleted. `audioPrunedAt`
  exists and the UI reports it, but nothing prunes automatically (§5.7).
- Item text is fixed once created; editing an item with recordings in flight is
  the revision question the reviewer flagged for CP3 follow-up.
- Reference audio is not cached: each **Hear it** is a new speech request.

### CP3 correction — integration and reliability (2026-09-22)

**All four reliability findings fixed, plus the Analysis action and reference
reuse. Still in CP3. Uncommitted.**

#### 1. Recording and playback can no longer overlap

The shared playback authority (`platform/audio/speech.ts`) now owns the
microphone too, because they are one resource: playing through the speakers
while recording puts the app's own voice into the attempt.

`beginCapture()` stops whatever is playing and revokes the playback permit;
`endCapture(token)` returns it, and a stale token — a recording already
replaced — cannot re-enable playback for the one that followed it.
`interruptSpeech()` returns null outright while the microphone is held, so
every caller (Chat's message speech, reading read-aloud, Drill's reference and
replay) is refused by the same rule rather than each remembering to check.
Lifecycle resume also respects it: coming back to the app does not hand playback
back mid-recording. `useMicRecorder` claims on start and releases on stop,
cancel, unmount and failure, so this applies to Chat as much as to Drill. Drill
additionally disables Hear it, Replay, phrase switching and Delete while
recording, so the rule is visible rather than only enforced.

#### 2. Saving an attempt is durable and idempotent

Native: `save_drill_attempt` verifies the receipt before storing anything — it
must belong to *this* item and be in state `succeeded`, so an attempt is never
attributed to another phrase's recording or to one that produced no transcript.
A unique index on `transcription_attempt_id` plus an existing-attempt check make
a repeated save return the attempt already stored rather than recording the same
utterance twice.

UI: a recording is marked stored only after the save succeeds, so a failure is
retryable; each save attempt is keyed by recording and explicit try, so a
re-render never retries by itself (it did, before — the effect re-fired and
silently saved again). The failure is shown with a **Try saving again** button.

#### 3. A reference belongs to the phrase that asked for it

The reference is stored with its item id and applied only if that phrase is
still showing when the speech returns; switching phrases mid-request discards
it. The paired panel only shows a reference whose item matches. Aids now use the
**item's own stored language, variety and explanation pair** rather than today's
settings, so analysis and word meanings ask about the phrase as it was written.
The same scope goes to `ReadingScopeContext`, so every shared tool on the card
inherits it.

#### 4. Audio cleanup recovers from failure

The attempt row is written first and the audio after it: a failed write leaves
an attempt with a transcript, a score and no audio — honest and still
replayable as text — instead of an orphan file nothing identifies. Deletion
reverses that order: files first, and if one cannot be removed the rows that
name it stay, so no audio is left unidentified. `reconcile_drill_audio()` sweeps
files no attempt claims, and runs at startup, so an interrupted save or a
half-finished delete cannot leave audio behind forever.

#### Analysis, and paying once for a reference

The target card's Analysis action is wired to the shared explanations aid
(CP2b). `DrillAnalysis` requests it bound to `[item, scope]`, abandons the
request when either changes, and renders the cards with the new shared
`components/reading/ExplanationCards`, extracted from `AnalysisContent` along
with `ReadingExample` (now in `components/reading/`). Chat renders through the
same components.

Reference audio is kept per item for the visit, so hearing it again replays the
audio already in hand instead of paying for another speech request. It is not
yet cached on disk across visits — that is the D5 cache, listed below.

#### Verification (automated)

`cargo test --lib` 565 passed, 0 failed, 6 ignored (3 new). `npm test` 1114
passed across 163 files (4 new), run three times for stability after fixing
two load-sensitive waits. Clippy, fmt, build, contracts, styles, previews,
languages (1141 × 7) and tsc all clean.

New native tests: a receipt that is still running, that failed, that belongs to
another item, or that does not exist is refused; a repeated save returns the
same attempt; orphan audio is swept at reconcile and at startup while claimed
audio survives; a failed audio write still records what was said.

New UI tests: playback is refused while recording (and restored after), a failed
save is retryable and never stores twice, a reference in flight never attaches
to the phrase switched to, and analysis asks in the item's stored variety and
only once.

#### Remaining CP3 work, stated plainly

- **Retention** (§5.7): nothing prunes yet. `audioPrunedAt` is honoured
  everywhere it appears, but there is no cap, no setting and no policy for
  reference audio. Needs the cap setting, a prune pass, and disk-full handling
  beyond the current explicit failure.
- **Sessions and visits** (§5.1): `drill_sessions` and `drill_visits` do not
  exist. Attempts hang off the item directly, so there is no session boundary,
  no visit ordering and nothing for auto-advance to bind to later.
- **Item revision**: item text is still fixed after creation. Editing a phrase
  with recordings in flight needs the revision semantics the reviewer asked for
  before mutable items exist.
- **Reference cache across visits** (D5): the per-visit reuse above is not the
  durable cache keyed by text, language, variety, voice and model.

#### Next inspection (macOS)

No schema version change since the last check, so no reset is needed unless the
workspace predates 30. Confirm: Hear it and Replay are refused while recording
and work again after Stop; Analysis on a phrase returns cards; hearing the same
reference twice makes only one speech request (the AI activity view shows one);
switching phrase mid-playback never shows the previous reference; and deleting a
phrase removes its attempts and audio.


### CP3 correction review — 2026-09-22

**Partial fixes accepted; CP3 reliability is not yet signed off.** Item-scoped
aids, successful-receipt ownership checks, duplicate-recording lookup, shared
Analysis cards, in-memory reference reuse and orphan reconciliation are present.
Preserve these; no redesign of the shared capability stack is requested.

Remaining correction requirements, in priority order:

1. **P1 durable attempt publication is still absent.** voice.rs returns the
transcription to React without persisting a Drill attempt. DrillPage remains
solely responsible for save_drill_attempt. Switching item or leaving while
transcription is pending makes useMicRecorder discard the result; nothing
native saves or recovers it. An explicit save retry only helps while that
result remains mounted. Finish the requested native publication/recovery seam
and test navigation/restart during completion. Do not mislabel UI retry as
durable recovery. Production recording saves also still allow a null receipt;
keep any genuinely separate text-only path explicit rather than bypassing
recording provenance via an optional argument.

2. **P1 failed audio saves cannot actually be retried.** Store::save_drill_attempt
commits the row, then writes audio. If that write fails, retry finds the receipt's
existing row and immediately returns it, never retrying the write. The UI then
reports success and drops its pending result even though audio remains absent.
Preserve one attempt and resume incomplete audio persistence, with an explicit
state and a real-native test: fail audio write, repair storage, retry the same
recording, assert the same attempt now has readable matching audio. Current
mock UI retry test does not exercise this path. Reconciliation also keeps every
row-named file, including incomplete files whose row has no audio_bytes; handle
these states explicitly rather than just removing files without any row.

3. **P1 shared audio authority breaks lifecycle suspension.** Reproduced with a
temporary focused test: setPlaybackAllowed(true), beginCapture(),
setPlaybackAllowed(false), endCapture(token). speechPlaybackPermit() incorrectly
returns an object rather than null. Keep lifecycle eligibility independent of
the capture token. A second beginCapture also replaces an existing capture token
instead of refusing it: a failed second native start can release playback while
the original recording remains active. Cover both cases. useMicRecorder releases
its token before browser finish/native stop acknowledgement and before async
cancel completes; keep exclusion until hardware capture has actually stopped.
The claim “speakers can never be recorded” is not established by the current code.

4. **P2 reference cleanup and settings remain incomplete.** DrillPage's reference
AbortController is still local and never aborted on item change/unmount. The
item check guards the completed reference image, but old playback/errors can
outlive the page. Cancel pending and active reference/replay on owner disposal.
Reference replayAudio still hardcodes rate/volume 1,1; use configured settings
through a shared replay helper rather than another local playback wrapper.
Unscoped list reload/save completions can also reselect an older item; guard
publication by the active language/selection generation.

The focused suspension reproduction failed and was removed after execution.
See reviewer response for focused suite results. No application implementation
was edited. No new Mac run, reset, provider call or commit performed. Keep
retention, session/visit behavior and durable reference cache on the remaining
CP3 checklist, but resolve the four reliability points before expanding scope.


### Implementation takeover — reliability wiring handoff (2026-09-22)

**Implemented and automatically verified in the Mac checkout. Ready for the
other agent's top-layer UX/UI pass; this does not declare all CP3 features done
or replace the next live Mac smoke check.** The user explicitly asked the
reviewer to take over the wiring. This entry supersedes the four outstanding
correction requests in the preceding review. No commit, reset, deployment or
paid provider request was performed. Unrelated server/diagnostics work remains.

#### Native publication now owns the attempt

`mic_transcribe` calls `Store::publish_transcription` with the native provider
result and captured WAV. For a Drill owner, receipt success, transcript,
comparison, receipt linkage and pending audio commit in **one SQLite
transaction**, before any result is returned to React. Chat retains its existing
receipt/result behavior. A failed attempt insert rolls back receipt success.
Owner validity/connection checks and diagnostic retention still go through the
shared transcription implementation.

The frontend `save_drill_attempt` command and adapter are removed. The UI cannot
submit a caller-chosen transcript/audio pair or omit receipt provenance. The
same-named Store helper exists only under cfg(test) for fixtures. Native attempt
staging validates the succeeded receipt's item and uses the unique receipt
index; duplicate fixture delivery returns the original attempt.

Schema **31** adds `drill_attempts.pending_audio`. Committed pending audio is
retained content, not diagnostic data. `audioBytes` includes bytes retained in
SQLite pending materialization as well as bytes already on disk. On the first
`get_drill_attempt_audio`, pending bytes are written to a temporary file,
fsynced, atomically renamed and directory-synced; only then is pending_audio
cleared. A write/update failure leaves durable bytes for the next explicit
retry. This also recovers after reopening without a frontend save buffer.
Audio can remain in SQLite until first requested; this is intentional, not a
claim that every new attempt already has a separate WAV file.

The retained-audio UI reports read/materialization errors and offers Try again.
Retries repair the existing attempt rather than adding another. File cleanup
still removes unclaimed/temporary files at startup. During partial item deletion,
each successfully removed file is marked removed in its still-present row;
failed removal keeps the item and remaining records available for retry.

Limits of durability: a process killed before the transaction commits cannot
retain an uncommitted provider response. Such interrupted provider work follows
the existing unknown-outcome behavior; there is no automatic paid replay. This
is not a promise of recovery from storage failure that prevents any DB commit.

#### UI no longer owns saving

DrillPage refreshes on entry and on shared recording-publication notifications.
The recorder emits completion after native publication even if its originating
component has unmounted; the old composer still rejects stale results. There is
no recurring list polling or second save command. List reloads are guarded by
language, request generation and mount state, and background completions cannot
force a previous phrase selection back onto the page.

#### One playback/capture authority

Lifecycle eligibility is now separate from capture ownership. Ending capture
while suspended does not enable playback; a competing capture claim is refused
without replacing the first token. Cancellation holds exclusion until native
acknowledges stopping, including unmount during an in-flight start/cancel. A
failed cancellation reports the error and retains exclusion rather than assuming
hardware stopped.

Conservative current behavior: Stop holds playback exclusion until the shared
`mic_transcribe` call returns (including its provider time), because there is no
separate native hardware-stopped acknowledgement. Drill disables Hear it/replay
while Working to match this. Do not re-enable playback merely when the React
recording flag turns false. A later faster transition would need an explicit
native stopped signal, not an independent Drill audio lock.

Fetched speech and retained reference/attempt replay use the same
`replaySelectionAudio`/reading-speech playback lifecycle. Item change, closing an
attempt detail and page disposal abort pending/active playback. Late reference
results/errors cannot publish into another item. Both initial speech and replay
honor configured rate and master × voice volume. Existing item-owned aid scope
and the shared Analysis action remain in place.

#### Verification of the final snapshot

- Native full suite: **572 passed, 6 ignored**.
- UI full suite: **1121 passed across 165 files**.
- TypeScript, build, contracts check, previews, styles and git diff-check passed.
  Clippy with warnings denied and rustfmt checks passed during the wiring pass;
  subsequent native addition was the passing partial-deletion regression.
- Build retains its existing large-bundle advisory; no build failure.
- Regressions cover atomic publication, reopen with pending audio, failed audio
  write followed by repair/retry, idempotency/owner checks, partial deletion,
  lifecycle suspension, competing capture, delayed cancel acknowledgement,
  completion after unmount, reference cancellation, replay disposal and volume.
- No new live macOS capture was performed. The previous user's schema-30 run
  proves the earlier path worked, not this changed schema/publication path.

#### Handoff to the UX/UI agent

Pull the current checkout/this note before editing. Do not reapply the older
`.drill-cp1/cp3.patch` over this work: that patch predates native-owned publication.
Keep the shared recorder, playback helper, reading tools and spectrogram. The
UI should display native attempts; it must not recreate a client save queue or
send transcript/audio back to manufacture an attempt.

Focus next on the actual manual practice interaction: clear phrase selection,
reference/record/working/replay states, useful attempt presentation, readable
paired inspection, compact layout and accessible narrow-screen behavior.
Use transcript-match wording, not a pronunciation-accuracy claim. Bring back a
concrete working UI for the user's review rather than another generic plan.

For the live check, rebuild the native app; schema 31 requires a development
Factory Reset (not yet performed here). Exercise recording then leaving while
Working, returning to find exactly one saved attempt, reference replay without
a new speech request, switching phrases during a pending reference, replay
volume, cancellation and deletion. No reset/migration was silently performed.

Retention/pruning policy, durable reference cache, drill sessions/visits and
future item revision semantics remain separate unfinished CP3 behavior. They
must use native ownership/storage where appropriate; they are not solved by
this reliability pass and must not be hidden as cosmetic UI work. Automatic
capture and generated sets remain later checkpoints.


### CP3 session/visit ownership checkpoint — 2026-09-22

**User smoke-tested the previous schema-31 reliability wiring and reported that
it runs OK. That checkpoint now has user-reported live verification. This new
session/visit slice is implemented and automatically verified, not yet live-tested.**

This continuation deliberately completes one bounded dependency before durable
reference caching and retention. No app reset, migration, commit, deployment or
live provider request was performed. Separate server/admin work was preserved.

#### Implemented behavior

- A native session starts when Drill opens in the active practice language and
  ends when leaving/changing language. Since own-phrase mode has no sets yet,
  language is the current session scope; no placeholder sets were introduced.
- Selecting a phrase enters a new native visit. Returning to the same phrase
  creates a new visit, with its own attempt/exact-transcript-match counts.
- Native microphone start resolves and captures the active visit. The eventual
  receipt and attempt use that captured visit even when it has ended and the
  learner is viewing another phrase. No recording path or receipt state machine
  was duplicated. A Drill item with no active visit cannot start recording.
- Session replacement closes the earlier session and its visits; cleanup for an
  older session cannot close a newer one. On restart, open sessions/visits close
  with an interrupted reason. Existing attempts and scores remain.
- The frontend serializes session/visit transitions across page instances,
  including delayed startup and unmount cleanup. Record stays disabled until
  the native visit is ready. Session-start failure reports an error and offers
  explicit retry. These records do not award XP or update learner competence.

#### Contracts and storage

Schema **32** adds drill_sessions/drill_visits, an originating visit on the
transcription receipt, and visit_id on the attempt. Native views expose visit
attempt counts and exact transcript matches; these are not pronunciation scores.
The existing schema-31 pending-audio publication remains atomic and unchanged.

Commands: start_drill_session, end_drill_session, enter_drill_visit,
leave_drill_visit, get_drill_sessions. Generated DrillSessionView/DrillVisitView
and DrillAttemptView.visitId expose the data. Frontend callers use ipc/drill.ts
and useDrillVisit, not local counters or hand-built owner history. The backend
supports explicit ending; a separate visible End/start-again control is left to
the top-layer interaction pass. Current navigation closes/opens automatically.

#### Verification

575 native tests passed (6 ignored); 1124 UI tests passed across 166 files.
Build, TypeScript, contracts, styles, previews, clippy with warnings denied,
rustfmt and diff-check passed. New regressions cover original-visit attribution
of a late response, fresh counters on returning, cross-language/item rejection,
old-session cleanup, interrupted-session recovery, delayed visit transitions,
unmount during session creation and explicit retry after startup failure.

#### Next bounded work

Durable reference caching and an explicit audio retention policy are next. Their
storage/accounting must include pending SQLite audio as well as files. Workspace
export currently copies DB files only; exported Drill WAV files must be covered
when completing retention/export behavior. Keep reference provider execution on
the existing reading/speech path and distinguish reference checks from attempts.
Do not add automatic recording or generated sets in this checkpoint.

The next native rebuild requires a schema-32 development reset; no reset has
been performed or requested as part of this source verification. The user's
last smoke test was schema 31. Another live check can be grouped with the next
backend checkpoint instead of repeating setup for every small contract change.

### CP3 durable reference checkpoint — 2026-09-22

**Running application evidence:** Jon reports that the session/visit checkpoint
also runs correctly. That smoke check preceded this reference-cache change.

**Implemented:** Drill's Hear it now opts into phrase-owned durable audio through
an optional `referenceItem` on the existing reading request. Native checks that
its text and resolved target language/variety still match the unarchived item.
No second generation executor, playback manager or provider contract was added.
Ordinary reading requests do not retain source audio through this cache.

The cache identity hashes the speech input (including voice), resolved language
context, content configuration and captured provider target. Every Hear it call
checks native ownership/configuration, including replays during the same mounted
page. A successful cache hit links `sourceReceiptId` in a content-free receipt,
sets `cacheHit`, and never dispatches provider work or increases paid usage.
Generation still uses all existing access, cancellation, admission, refusal and
receipt handling. Cache replay currently also uses those access-validity checks;
this checkpoint does not promise offline replay without valid AI configuration.
Concurrent active reference requests for one item are refused, not silently
queued or retried. Cache publication and receipt completion share a transaction;
publication errors retain response metadata in the failed receipt.

References are regenerable: the cache uses the existing speech limits of 4 MiB
per audio result and 16 MiB total, evicting least-recently-used media. This is a
bounded cache, separate from the still-pending learner-recording retention
setting. Eviction retains provider receipts and usage; deleting an item cascades
to its reference audio. Changed source or generation configuration requires a
new explicit Hear it request. Playback-rate and volume preferences remain local
playback parameters and do not require new synthesis.

**Workspace lifecycle:** schema 33 adds `drill_references`; reference bytes are
in SQLite, so existing database export/reset includes them. Fixed the discovered
export omission: workspace copies now also include the `drill-audio` directory
under the same store lock. Unsafe directory/symlink entries fail the export;
incomplete exports are cleaned up, never published as successful snapshots.
No application data was reset in this checkpoint.

**Verification:** 578 native tests passed (6 ignored), 1,124 UI tests passed.
New coverage generates a reference through the real reading command against a
local fake provider, reopens the workspace, then replays after the provider has
shut down; the audio and source receipt survive and dispatch count stays fixed.
Also covered source/model/config invalidation, deletion while a request exists,
LRU budget enforcement without dropping receipts, duplicate request refusal,
and repeated UI playback checking native ownership. Export tests now verify
WAV copies and reject unsafe audio entries. Build, TypeScript, clippy, fmt,
contracts, previews, styles and diff checks pass. No live provider run for this
slice yet; rebuild/reset is needed for schema 33 before its next Mac smoke test.

**Next bounded checkpoint:** learner-recording retention/pruning, including both
pending SQLite bytes and published WAV files, preserving transcript/comparison
records and reporting unavailable audio explicitly. Reference caching is now
implemented; do not build another reference-fetch or playback path in the UX
pass. Sessions/visits and references are ready for that pass, but overall backend
completion is not claimed until the remaining retention wiring is verified.
Changes remain uncommitted; unrelated server/admin/diagnostics work was left alone.


### CP3 recording retention checkpoint — 2026-09-22

**Running application evidence:** Jon reports the durable-reference build still
runs. The new retention control below has automated coverage but needs the
specific Mac behavior check at the end of this entry.

**Implemented policy:** native recording storage defaults to 500 MB (decimal),
with 100 MB / 500 MB / 2,000 MB / Keep none. This adopts the D8 proposal for
learner recordings. The control explicitly excludes the separate 16 MiB reference
cache; Keep none does not erase reference audio. Generated contract constants
supply the UI option values; validation and pruning stay native. The control is
collapsed under **Recording storage** on the manual Drill page, with current
recording/reference byte totals and explicit Apply/retry actions.

**Durability and failure behavior:**

- Oldest audio is pruned across both pending SQLite blobs and published WAVs.
  Transcripts, comparisons, visit attribution and provider receipts remain.
- Publication checks the current setting inside the receipt/attempt transaction.
  Keep none never stages future recording audio, including when the policy is
  changed while transcription is in flight. Existing recordings are pruned when
  Apply is pressed.
- Rows are marked unavailable before their files are removed. Bytes pending
  removal remain accounted for until deletion succeeds. Errors keep their useful
  IO diagnostics and explicitly say that the attempt/policy is already saved.
  Retrying cleanup never sends another provider request. Startup retries an
  interrupted cleanup; an unresolved filesystem failure remains an explicit error.
- The shared mic hook refreshes a Drill owner even when native reports a
  post-publication cleanup failure, so the saved attempt remains visible.
- File reads/publication/pruning/export share Store's lock. Replay already in
  progress owns loaded bytes, so pruning the file cannot interrupt it.
- Deletion also removes partial WAV writes. Fresh schema-34 workspaces enable
  SQLite incremental vacuum, and cleanup consumes every yielded vacuum step.
  Regressions confirmed that clearing blobs actually reduces database pages;
  the first implementation reclaimed only one page and was corrected.
- Reference generation/playback remains on the shared reading/speech path, and
  Keep none was verified not to remove its separate cache. Export/reset behavior
  from the prior checkpoint remains in place.

**Automated verification:** 583 native tests passed (6 ignored); 1,128 UI tests
passed across 167 files. New tests cover mixed pending/file oldest-first pruning,
keep-none persistence, actual transcription publication under an in-flight policy
change, preservation of usage/comparisons, restart cleanup after a real IO failure,
SQLite page reclamation, reference independence, storage-read retry, explicit
cleanup retry and UI refresh after post-publication failure. Build, TypeScript,
clippy, fmt, contracts, styles, previews, languages and diff checks pass.

**Specific Mac check now requested:** rebuild with `npm run macos:dev`; schema 34
requires the usual development reset. Add a phrase, Hear it, record and replay one
attempt. Under Recording storage choose Keep none and Apply: the existing attempt
must retain its transcript/comparison while replay becomes unavailable. Record
again: the new attempt must appear with no retained audio. Restart: Keep none and
both attempts must persist; Hear it must still work using the reference cache.
Finally choose 500 MB and Apply, record once more, and verify replay works again.
No need to create 100 MB of test audio or induce storage faults; those cases have
native regression coverage.

**Backend handoff boundary:** shared aids, capture/transcription, comparison,
atomic attempt publication, session/visit ownership, durable references and
recording retention are implemented for the manual phrase workflow. This does not
claim the full proposed feature is finished. History pagination (current item,
attempt and session queries have fixed limits), generated/conversation-derived
sets, editing/revision semantics beyond today's immutable phrases, automatic
attempt capture and optional reference-ASR checks remain separate work. UX should
compose the existing owners/contracts rather than build parallel implementations.
The next UX handoff should follow this live retention check and keep those gaps
explicit. No source commit, deployment or application-data reset was performed.

### UX-CP1 — the practice layout, the record dock and a typed storage limit (2026-09-22)

**Design first.** The learner reviewed the Drill design canvas and approved a v1
row drawn against the contracts that exist: phrase rail, target card, record
dock, attempt log, paired spectrograms with activity-derived utterance markers,
and honest word-timing states. The full-vision boards stay on the canvas as the
destination; sets, levels, capture modes and auto-advance are not built here.
The reviewer asked for working software over further mockups, so this slice
implements the layout and the dock and leaves attempt presentation to UX-CP2.

**Implemented**

- `DrillPage` is a three-column practice surface: `PhraseRail` (add, select,
  delete, with recording storage collapsed in its footer), the stage (target
  card, reference playback, record dock) and the attempt log. Under 60rem the
  three stack in reading order. No data ownership changed: the reload guards,
  visit ownership, recording-publication subscription and reference request
  cancellation are the same code paths, moved intact.
- `RecordDock` names the four states in words — preparing, ready, recording,
  transcribing — with one control that starts and stops an attempt, Discard only
  while recording, and the shared `WaveformStrip`. Recording is refused until the
  native visit is open. Colour repeats the sentence; it never carries it alone.
- `PhraseRail` shows attempt count and the best measured match per phrase, and
  says plainly when no attempt could be measured rather than printing a number.
  Deleting names what goes with the phrase, since phrases stay immutable.
- `mic`, `stop`, `play` and `trash` were added to the shared `ToolbarIcon` set
  rather than inlining SVG in a feature.

**Recording storage is a typed number, not preset sizes.** The learner enters a
whole number of megabytes; zero keeps none. `LIMITS_MB` is gone. Native validates
`0..=MAX_LIMIT_MB` (100,000) and the generated contract exports
`DRILL_RECORDING_MAX_MB`. Schema **35** replaces the `limit_mb IN (0,100,500,2000)`
check with `BETWEEN 0 AND 100000`; a development reset is required. Apply stays
disabled for anything that is not a whole number in range, so no guessed value is
ever sent. Pruning, accounting and failure reporting are unchanged.

**Verification (automated).** 579 native tests passed (6 ignored); 1,133 UI tests
passed across 167 files, including three new Drill regressions (dock states with
a held-open visit, best-match display, and an unmeasurable attempt counted
without a score) and three new storage regressions (a typed limit is sent, an
arbitrary size is accepted, and a non-integer or out-of-range value is refused
before any command). Build, TypeScript, contracts check, styles check, dead-style
report, previews, languages (1,167 messages × 7 locales), clippy with warnings
denied, rustfmt and diff-check all pass.

**Still open, stated plainly.** Attempt presentation is unchanged from the
reliability pass: the log is still a list with an expanding detail, not the
designed cards, tiles, alignment strip or paired inspection. Utterance markers
and the silence threshold are drawn in the design but not yet rendered from
`InspectionActivity`; word timings are not yet read from `InspectionWordTiming`.
History pagination, generated and conversation-derived sets, item revision,
automatic capture and reference-ASR checks remain separate work. No commit,
deployment, reset or provider request was performed; unrelated server and admin
changes in the checkout were left alone.

**Next Mac check (after `npm run macos:dev` and a schema-35 development reset).**
Add a phrase and confirm the rail, stage and log layout. Record one attempt and
watch the dock move from ready through recording to transcribing. Confirm Hear it
and replay are refused while recording and return afterwards. Open Recording
storage, type 1234 and Apply, then type 0 and Apply, and confirm the existing
attempt keeps its transcript while replay becomes unavailable.

### Item-source seam — the contract between the UX and backend tracks (2026-09-22)

**Why this exists.** Two agents now work in parallel. The backend agent owns
where drill items come from; the UX agent owns what practising one looks like.
A drill item is a row with text and a language scope, and the practice surface
does not care how it was written, so the two tracks only have to agree here.
This revision incorporates the backend agent's four corrections. Nothing in it
is implemented yet.

**Learner decision recorded.** v1 has three sources: the learner's own typed
phrase (built), phrases generated from a topic the learner types, phrases
generated from their level with no topic, and sentences taken from their past
conversations. The skill-map source is explicitly parked, not deferred by
accident. No further product decisions are outstanding.

#### 1. Items carry their provenance

`DrillItemInput` and `DrillItemView` gain a tagged source, shaped like the
existing `RecordingOwner` so there is one idiom for this in the codebase:

- `{ kind: "own" }` — typed by the learner. Today's behavior, unchanged.
- `{ kind: "generated", requestId, candidateId, topic }` — `topic` is null for a
  level-only request. The pair identifies the native candidate the item came from.
- `{ kind: "conversation", sourceRef, revision }` — `sourceRef` names the exact
  message or coach edit, and `revision` pins the text as it was when taken.

Items stay immutable. Deleting an item still cascades to its attempts,
references and audio.

#### 2. Preview, then accept — native-owned candidates, idempotent acceptance

Two commands. A paid request must never write rows the learner did not see, and
Regenerate must not become a client retry loop.

- `preview_drill_items({ language, variety, explanation, explanationVariety,
  topic, count, difficulty })` → `DrillGenerationPreview { requestId,
  candidates: [{ candidateId, text, translation, reported, verified }],
  shortfall, receiptId }`.
- `accept_drill_items({ requestId, candidateIds })` → the committed
  `DrillItemView`s.

Binding rules, all native:

- **Candidates are native-owned rows**, persisted with the request and its
  receipt. The caller sends ids, never text. A caller-supplied phrase cannot
  enter the generated source at all; typing one is the `own` source.
- **Acceptance is idempotent.** Repeating `accept_drill_items` with the same
  `requestId` and ids returns the original items. It never duplicates a phrase
  and never issues another paid request. Accepting a subset, then accepting more
  from the same request, is normal and adds only the new ones.
- An unknown, expired or already-consumed `requestId` is an explicit error.
  Regenerate is a new request with a new receipt, chosen by the learner.
- `shortfall` states plainly when fewer usable candidates came back than were
  asked for. Nothing is invented to fill it, and there is no automatic retry.

#### 3. Generation reuses what exists

No new provider path, prompt assembly or receipt shape. Generation uses the
existing difficulty definitions in `configuration/difficulty.rs`, the existing
structured-completion machinery, and the existing admission, cancellation,
receipt and refusal handling. The only new content is the drill task text under
`content/prompts/drill/`. A separate generation executor would be a duplicate
implementation under §2 of this plan and is not acceptable.

#### 4. Three kinds of label, never merged

A candidate carries them as distinct fields, and the UI renders them distinctly:

- **Requested** — the difficulty context and focus the learner asked for.
- **Reported** — labels the model returned about its own output.
- **Verified** — properties checked mechanically here (language, script, length,
  non-empty, duplicate against existing items).

A model reporting "beginner" is not validated difficulty and is never stored or
displayed as one. Only verified properties may gate acceptance.

#### 5. The conversation source is extraction, not generation

`conversation_drill_candidates({ language, variety, limit, cursor })` →
candidates with exact source and revision provenance and **no provider call at
all**. The text is taken as it stands; it is never quietly rewritten, cleaned or
re-generated on the way through. Level is unclassified unless the source already
carried one; it is never inferred. Picking calls the same `accept_drill_items`
path with a conversation source.

#### 6. Pagination — one coordinated contract change

Item summaries plus separately paged attempts is the right shape. Removing
`item.attempts` breaks the presentation work in flight, so it happens in three
agreed steps rather than one:

- **Step A (backend, additive).** `DrillItemView` gains `attemptCount`,
  `bestMatchRatio` (null when nothing was measurable) and `lastAttemptAt`, and
  `drill_attempts({ itemId, cursor, limit })` → `DrillAttemptPage { attempts,
  nextCursor }` is added. `attempts` stays on the view, unchanged. Nothing breaks.
- **Step B (UX).** The rail reads the summary fields; the log reads the paged
  command. UX-CP2 lands or is updated on this basis, and its handoff says the
  embedded array is no longer read.
- **Step C (backend).** `attempts` is removed from `DrillItemView` and
  `drill_items` gains its own cursor. This is the only breaking moment, and it
  happens after Step B is verified.

Proposed shapes, for the backend agent to correct rather than infer:

```ts
type DrillItemView = { /* …existing… */ source: DrillSource, attemptCount: number,
  bestMatchRatio: number | null, lastAttemptAt: string | null }   // `attempts` removed at Step C
type DrillAttemptPage = { attempts: DrillAttemptView[], nextCursor: string | null }
type DrillCandidate = { candidateId: string, text: string, translation: string | null,
  reported: { difficulty: string | null, tags: string[] },
  verified: { language: boolean, script: boolean, lengthOk: boolean, duplicate: boolean } }
type DrillGenerationPreview = { requestId: string, candidates: DrillCandidate[],
  shortfall: { requested: number, produced: number, reason: string } | null, receiptId: string }
```

#### 7. What the UI will never do, so the backend can rely on it

No client save queue. No caller-supplied transcript, audio or candidate text. No
second reference-fetch or playback path. No client-side retry of a paid request.
No invented number where a measurement is missing. Attempt publication, visit
ownership, durable references and retention stay exactly as the backend owns them.

#### 8. Sets are deferred on purpose

The practice surface is a flat list of phrases per language. `drill_sets` buys
nothing until the add-phrases flow exists, and adding it now means schema churn
against a UI that cannot show it. Source provenance on items is required now;
sets are designed with the Setup flow in step 3 below.

#### 9. Order of work

1. This note (done). 2. In parallel: backend builds §2–§6 Step A; UX builds
UX-CP2 (attempt presentation — verdict, measurement tiles, word alignment,
paired spectrograms with `InspectionActivity` markers and threshold, honest
`InspectionWordTiming` states, replay), then §6 Step B. 3. Together: the
add-phrases flow on top of the finished contract, and sets with it, then §6
Step C. 4. UX-CP3 (narrow screen, empty and error states, accessibility) and the
conversation-source UI.

Tests each side owes: the backend owes repeated acceptance producing no
duplicate phrase and no second paid request, candidate ownership (a
caller-supplied phrase cannot enter the generated source), shortfall reporting,
refusal and receipt provenance, the three label kinds staying distinct,
conversation provenance exactness with no rewrite, and pagination stability
under concurrent publication. The UX owes the rendering and state regressions
for whatever it shows.

### UX-CP2 — attempt presentation, and the shared inspection tracks (2026-09-22)

**Extraction first (the reuse gate).** Chat's `TranscriptionInspector` already
drew detected activity, the timed-word track, the word-timing status line and
the detection details. Drill needs all four, so they moved to
`components/media/InspectionTracks.tsx` and **Chat was migrated onto them in this
same change**: `ActivityTrack`, `TimedWordTrack` (interactive for Chat, read-only
without handlers), `WordTimingNote`, `DetectionDetails` (its retention sentence
is `children`, because Chat's audio is in memory and Drill's is retained), plus
`useSeconds`. `UtteranceMarkers` is new and shared from the start. Their styles
moved from `features/conversation/speech-inspection.css` to
`components/inspection-tracks.css`, imported after `spectrogram.css` to preserve
cascade order. No Drill copy of any of this exists.

**The attempt log.** `AttemptLog` is now a list of cards — sequence, chips, time,
measured match, the transcript, and a meta line of exact words and what happened
to the recording. Selecting a card puts that attempt in the panel; nothing
selected means the newest, so a finished attempt takes the panel by itself.

**The panel.** `AttemptInspection` shows four tiles (transcript match with the
normalizations that preceded it, words exactly as written, length beside the
reference's, and whether the recording is kept, removed or never kept), the
word-by-word alignment with each outcome named in text, the paired spectrograms
on one shared dB window, and replay through the shared playback authority.

**Utterance markers and the threshold (the learner's decision from E4).** The
reference is one take; a learner recording may hold several. Markers are drawn
from `InspectionActivity.regions` — in the silence between consecutive regions,
never invented — and the caption counts them. The threshold and noise floor that
produced those regions are in the shared `DetectionDetails` beneath.

**Word timings are honest.** `InspectionWordTiming.status` decides: a real track
when the recognizer returned timings, and `WordTimingNote` with the recognizer's
own reason when it did not. The fabricated timed strip in the design mockup is
not implemented and will not be.

**No graded verdict, deliberately.** §5.2 of this plan says verdict thresholds
are policy data with a version. The comparison does not carry them, so the UI
shows no Match/Close/Off grade. It shows the measured percentage, and chips only
for what native established mechanically: `Exact` when the comparison needed zero
edits, and the existing advisory `Different script`. **Backend request:** when
threshold policy data lands, expose it on the comparison and the UI will render
graded verdicts from it rather than inventing cutoffs here.

**Observability.** The tiles are a reading of the measurement, not a replacement:
policy, character error rate, edits over reference graphemes and the applied
normalizations stay under a `Comparison details` summary.

**Verification (automated).** 1,136 UI tests across 167 files, including six new
Drill regressions: utterance markers appear for two detected regions and never
for one; the word-timing note replaces the track when the recognizer gave none;
`Exact` appears only at zero edits; the newest attempt fills the panel unasked;
replay stops when another attempt takes the panel; and the measurement stays
available under the summary. TypeScript, build, contracts check, styles check,
dead-style report, previews, languages (1,194 messages × 7 locales) and
diff-check pass. Native was untouched by this slice.

**Not done here.** The rail and log still read `item.attempts`; they move to
`attemptCount`/`bestMatchRatio` and paged `drill_attempts` at Step B of the
pagination agreement. Narrow-screen behaviour, empty and error states and the
accessibility pass are UX-CP3.

**Next Mac check.** Record two takes of one phrase in a single recording and
confirm the split marker and the utterance count; open Comparison details and
Detection details; play the reference and confirm the two spectrograms share one
scale; set storage to 0, Apply, and confirm the Recording tile says Not kept
while the transcript and comparison stay.

### UX-CP2b — three corrections, and Step B of the pagination agreement (2026-09-22)

**Corrections from the backend review, all applied.**

1. **Detected regions are speech segments, not takes.** `UtteranceMarkers` is now
   `SegmentMarkers`, the marker label reads `segment 2`, the caption reads
   `N speech segments`, and the component says in its own comment that detection
   does not establish separate attempts — a pause inside one utterance splits a
   region exactly as a second reading of the line does. The CSS class and the
   shared sheet's comment follow the same name.
2. **The two storage states were already distinct and are now pinned by a test.**
   `audio_pruned_at` set means **Removed** ("Freed by the storage limit"); a null
   `audio_bytes` with no prune timestamp means **Not kept** ("Storage is set to
   keep no recordings"). A new regression shows both on one phrase at once.
3. **Thresholds stay deferred, and the earlier backend request is withdrawn.**
   UX-CP2 asked for threshold policy data so the UI could render graded
   verdicts. That request was wrong and is retracted: the measurement compares
   recognized text, not pronunciation quality, so moving arbitrary cutoffs into
   native would not make them valid. The measured percentage plus an explicitly
   labelled exact transcript match is what Drill shows. Do not implement a
   grading scheme for this; it is not a missing backend feature.

**Step B — the UI no longer reads `item.attempts`.**

- `useDrillAttempts(itemId, active)` owns one phrase's history through
  `drillAttempts(itemId, cursor, limit)` at 20 per page. Native owns order and
  cursors. A publication for this item re-reads the **first page** rather than
  splicing a row in locally, so the list is always what native says it is. Late
  pages for a phrase the learner has left are dropped by a request generation,
  and unmount cancels.
- `AttemptLog` renders the loaded page with a `Show older attempts` control, its
  own loading state, and an explicit error with Try again. `AttemptInspection`
  takes the chosen attempt from the loaded page.
- `PhraseRail` reads `attemptCount` and `bestMatchRatio` from the item summary,
  so the count and the best match cover the whole history rather than whichever
  page is loaded — the case the backend's own regression covers, where the best
  attempt sits outside the bounded compatibility array.

**Step C is unblocked.** No source outside tests reads `item.attempts`; the only
remaining reference is the fixture factory, which sets the field to keep the
current contract shape. The backend agent can remove the array from
`DrillItemView` and add the `drill_items` cursor whenever it suits their
generation work.

**Verification (automated).** 1,138 UI tests across 167 files. New regressions:
history is read a page at a time and the embedded array is deliberately served
empty, so a log that still read it would fail; `Show older attempts` appends the
remainder and then disappears; and pruned versus never-kept recordings stay
distinct. Build, TypeScript, styles check, dead-style report, previews,
languages (1,195 × 7) and diff-check pass. Native untouched by this slice.

**Not done here.** Narrow-screen behaviour, empty and error states and the
accessibility pass remain UX-CP3. Generation and conversation extraction remain
with the backend agent.

### UX-CP3 — narrow screens, failure states and accessibility (2026-09-22)

**Narrow screens.** The three columns stack in reading order below the repo's
existing 860px breakpoint (the earlier `60rem` query was off the shared
breakpoint set and is gone; the style checker does not validate non-px queries,
which is how it slipped through). The record dock becomes sticky at the bottom
edge there, so the one control that records stays reachable while the inspection
panel scrolls. Coarse pointers get `--touch-target` minimums on the icon-only
delete and on the cards that carry selection.

**A phrase list that fails to load now says so.** It was previously only sent to
`reportFault`, so a failed read looked exactly like "you have no phrases yet".
It is now an explicit alert with Try again, in place of the empty message, and
the retry clears it on success. This is the fail-loudly rule: a silent empty
state was making an error look like data.

**Accessibility.**

- The dock's phase changes without the learner acting — a transcription
  finishing, a session opening — so its copy is a polite live region and is
  announced rather than only drawn. Its landmark is named for what it does
  ("Record an attempt"), not for the state it happens to be in.
- Each word-alignment entry carries one readable statement ("café, heard as
  cafe: letters differ") with the visual fragments hidden from the accessibility
  tree, because the bare columns say nothing about which side a word came from.
- Landmarks, `aria-current` selection, labelled icon-only controls, labelled
  form fields and the existing focus ring were checked and already correct.

**Verification (automated).** 1,140 UI tests across 167 files, including two new
regressions: the failed list read is announced and recoverable, and the dock's
live region reports Ready to record then Recording. Build, TypeScript, styles
check, dead-style report, previews, languages (1,198 × 7) and diff-check pass.
Native untouched by this slice.

**Drill's UX track is now at a natural stop.** Layout, the record dock, attempt
presentation, paged history, storage, failure states and accessibility are done
for the manual own-phrase workflow. The next UX work is the add-phrases flow,
and it waits on the backend agent's preview/accept generation and conversation
extraction contracts.

**Next Mac check.** Narrow the window below 860px and confirm the three sections
stack with the dock pinned to the bottom; with the window narrow, record an
attempt and confirm the dock stays reachable while the panel scrolls.

### Generation length controls — backend ready (2026-09-22)

Learner approved length independent of difficulty: word, short phrase, sentence,
or several sentences. Backend now requires `DrillGenerationInput.length` and
exports `DRILL_LENGTHS`; the prompt, response bounds and native validation use
that choice, and accepted generated items preserve it in provenance. Quantity
and length also determine bounded output headroom. Existing difficulty and the
shared generation executor are reused. Over-limit items produce a shortfall,
never truncation or automatic regeneration. Schema is 37.

The current adapters, exact controls, requested-versus-verified semantics and
integration checkpoint are in
[the generation UI handoff](drill-generation-ui-handoff-2026-09-22.md).
The Add phrases UI is the next connection; this backend slice does not change the
other agent's feature UI or styles.

### UX-CP4 — the Add phrases flow (2026-09-22)

Wires the backend's generation and conversation-extraction contracts per
`docs/notes/drill-generation-ui-handoff-2026-09-22.md`. No native change.

**One dialog, two sources, one acceptance.** `Add phrases…` in the rail opens a
dialog with **Generate** and **From your chats**. Both end at the same native
`acceptDrillItems(requestId, candidateIds)`, so selection, marking and adding are
one shared component rather than two flows. The inline "type a phrase" entry
stays where it is; it is faster than any dialog for a line the learner already
knows.

**Nothing happens without a press.** Changing topic, difficulty, length or
quantity never starts work and never changes what an in-flight request means —
the input is captured when Generate is pressed, and the preview is captioned
from the response's own `requested`, not from the controls as they now stand.
There is a regression for each half of that. Regenerate is a new explicit
request. Cancel aborts through the adapter's begin/run/cancel lifetime.

**Length is its own control**, from `DRILL_LENGTHS`, defaulting to Short phrase,
with the handoff's functional labels. Difficulty is the shared `DifficultySelect`
with local state, the same pattern `ConversationChoices` uses. Quantity is a
typed number, 1–20, and Generate stays disabled outside that range so no
out-of-range request is ever sent.

**The three kinds of claim stay apart in the UI, as they do in the contract.**
What was asked for is the caption. What the model said about its own output is
chipped as "Model says …". What native verified is the only thing stated as
fact: a duplicate is marked and cannot be selected. A shortfall is printed with
its reason and is never quietly refilled.

**Extraction is visibly not generation.** The chats source says the lines are
taken exactly as written, makes no provider call, and pages with `nextCursor`
(an empty page can still continue). Its candidates carry `requested: null`, so
the caption says where they came from instead of what was asked for.

**Verification (automated).** 1,150 UI tests across 169 files; eight new
regressions in `AddPhrases.test.tsx` cover: no request until asked and length
and difficulty sent as separate choices; an out-of-range quantity refused before
any request; acceptance by native id of only the chosen candidates, with adopted
rows marked and locked; the caption not following later control changes; a
shortfall stated without a second request; a duplicate marked and unselectable;
extraction with no generation call; and switching source abandoning the previous
offer rather than mixing the two. Build, TypeScript, contracts check, styles
check, dead-style report, previews, languages (1,228 × 7) and diff-check pass.

**Next Mac check — schema 37 needs a development reset.** Then, with a real
provider: a Word request and a Several sentences request at the same difficulty;
a topic request and a level-only request; accepting only some candidates;
pressing Add twice; explicit regeneration; switching language mid-generation; and
a language without spaces between words, such as Japanese. Fake-provider tests
establish wiring and bounds only — the linguistic quality of what comes back
still needs a real look.

### UX-CP5 — the Add phrases panel, and a dead-CSS report that can be trusted (2026-09-23)

**The add flow was a click-maze and is now two presses plus one per phrase.**
The learner's words: "15 different goddamn modals". There was one dialog, but
the path through it was ask → wait → tick boxes → press Add N → press Discard →
close. It is now: the rail's `Add phrases…` opens a panel **in the stage column,
not over the page**; Generate asks; each candidate carries its own **Keep**
button that adopts it immediately; **Keep all N** takes the rest. There is no
checkbox, no confirm step and nothing to dismiss — **Done** gives back whatever
was not kept, which is the same `discardDrillPreview` the old Discard did.

Nothing about the contract changed: acceptance is still by native candidate id
against the owning request, repeat acceptance is still native-idempotent, a kept
row still reports itself and cannot be kept twice, a duplicate is still marked
and has no Keep control at all, and no request is made until Generate is pressed.

**The dead-CSS report was lying, so it got fixed before anything was deleted.**
`prune-styles` scanned only `ui/src`, which is not where several live consumers
are: the preview harnesses under `ui/tools`, and — for every class in
`features/admin.css` — the server admin panel's own `index.html` and `admin.js`.
Fourteen of the nineteen reported classes were live, including the admin panel
the learner is actively working on. Running `styles:prune --write` against that
report would have deleted working admin styling.

- `SOURCE_ROOTS` now lists `ui/src`, `ui/tools` and
  `server/app/diagnostics/admin_assets`, and the walk reads `.html` and `.js` as
  well as `.ts`/`.tsx`. `prune` uses the same roots as the report, so a write can
  never delete a class the report would have called live.
- `dynamicPrefixes` now accepts a fragment that follows another class inside a
  string (`heat heat-${level}`), not only one that opens the string. That alone
  moved five `heat-*` classes from "dead" to "composed at runtime".

**Nine classes were genuinely dead and are gone**: `bar-fill`,
`conversation-map-toggle`, `inspection-confidence`, `saved-word-part`,
`saved-word-part-source`, `saved-word-parts`, `study-credit-badges`, `tok`,
`trans-d`, along with `popup-roman`, `popup-card`, `popup-x`, `popup-actions`
and the `rtl-line` selector parts the prune found with them. Each was confirmed
to have no consumer anywhere in the repository before the write. The report now
reads **0 unused**.

**Verification (automated).** 1,152 UI tests across 169 files; the Add phrases
suite gained a one-press-per-phrase regression, a Keep all regression and a
close-gives-back-the-rest regression, and the pruner's own architecture tests
still pass against the new roots. TypeScript, build, styles check, dead-style
report, previews, languages (1,230 × 7), graph check and diff-check pass. No
native change in this slice.

**Still open.** The wider Drill UX pass the learner asked for is not this slice:
this fixed the add flow and the CSS report only. Generation quality still needs a
real-provider look, and schema 37 still needs a development reset on rebuild.

### Continuous repetition — first desktop checkpoint (2026-09-23)

Implemented start-once, silence-separated takes through shared native capture and
transcription. Includes adjustable gap, bounded pending work, visible errors and
counts, current-take discard, owner/visit fencing, playback exclusion and explicit
restart after lifecycle suspension. Original E7/Milestone C is only partly complete:
mobile streaming and progression remain later work. No grading scheme was added.
See [implementation, limits and the Mac checkpoint](drill-continuous-repetition-2026-09-23.md).

### Continuous recording visual follow-up — September 23

Implemented native cut bounds/state, immediate take cards, shared live log-mel
analysis, higher-resolution completed inspections, and reference playback seeking.
Details, measurements, verification and the remaining reference-word-timing gap are
in [the continuous repetition note](drill-continuous-repetition-2026-09-23.md#implemented-visible-cuts-live-spectrum-and-reference-playback-september-23).
No schema change or commit. Next checkpoint is the live Mac recording/playback check.

### UX-CP6 — Add phrases becomes a raised dialog with one list of sources

**Shape.** Adding phrases no longer takes over the working column. `AddPhrases`
is now a `DetailDialog size="wide"` raised over the practice columns, which stay
where they are behind it. `DrillPage` renders the practice surface
unconditionally and mounts the dialog beside it, rather than swapping one for
the other.

**One list of what to add.** A single `<fieldset className="drill-add-options">`
holds the four `DRILL_LENGTHS` as checkboxes and `Lines from your chats` as a
fifth option beside them, separated by a rule rather than promoted to a section
of its own. There is no source mode, no tab, and no state in which neither
source is chosen and the dialog still looks coherent. The learner never picks a
chat: native already returns individual lines with their own provenance, so each
line arrives as its own row with its own Keep.

**Several lengths in one ask.** `DrillGenerationInput.length` still carries a
single `DrillLength`, so ticking several lengths is several requests sharing the
quantity out between them; the remainder goes to the earlier lengths in the
contract's own order, which `toggleLength` preserves regardless of ticking
order. `useDrillPreview.generate(inputs, alsoChats)` runs them in sequence,
pushing each preview into `pages` as it lands, then optionally appends one page
of chat lines. When the backend ships `lengths: DrillLength[]`, this collapses
to one request and one receipt; nothing else has to change.

**Shared machinery, not new machinery.** Candidate text renders through
`TargetText` — the same component every other target-language string goes
through — so word hover, gloss, reading scale and script scale come for free;
the private `.drill-candidate-text` span is gone. The form uses only house
patterns: `.form-row` label+field, `.check-row .check-label`, `.field`. The
oversized difficulty text was `DifficultySelect` hardcoding
`.chat-language-picker`; inside a `.form-row`, the shared `.form-row select`
rule outranks it on specificity, so the control matches every other field
without touching the shared component. Topic is explicitly optional and
clearable: the label says so and the field is `type="search"`, the same pattern
`LanguageBrowser` already uses — no custom clear button and no new CSS.

**Removed.** `.drill-sources`, `.drill-ask`, `.drill-generate`,
`.drill-add-head`, `.drill-candidate-text`, and the static explanatory copy that
went with them (eight message keys, in all seven locales). Four keys were added:
`What to add`, `Lines from your chats`, `Topic (optional)`,
`Pick at least one thing to add.`

**Still owed by the backend.** (A) `lengths: DrillLength[]` on
`DrillGenerationInput`, so a mixed ask is one paid request instead of several.
(B) A count of available chat lines before asking — until then the chats option
carries no badge rather than an invented number, and an empty answer simply says
so.

### Sync incident — continuous-repetition work overwritten, 2026-09-23

**What happened.** Committing UX-CP6 to the Mac wrote whole files without first
checking whether the continuous-repetition slice had touched them in the
meantime. It had. Seven locale catalogues, `drill.css` and `DrillPage.tsx` were
replaced with the cloud clone's older copies, discarding uncommitted work that
had no committed version to fall back on.

**Restored here, but rewritten rather than recovered.** Eighteen message keys
(`Take {value0}`, `Listening`, `Queued: {value0} · Processing: {value1}`,
`Recording timeline`, `Seek reference audio` and the rest) were re-authored in
all seven locales from the names the checker reported, and `.drill-take-arrival`
/ `.drill-take-pending` / `.drill-take-progress` were re-authored in `drill.css`
with a new `take-progress` keyframe in `motion.css`. These are replacements, not
the original text and rules: the continuous-repetition owner should read them
and replace any that say the wrong thing.

**Not restored.** Whatever `DrillPage.tsx` did to wire continuous capture is
gone. `RecordDock`'s `continuous`, `listeningStatus` and `liveSpectrum` props
and `AttemptLog`'s `liveTakes` prop all default to off, so the feature type-checks
and silently does nothing. Only the continuous-repetition owner can put that
back. Any edits that slice made to existing translations, rather than additions,
are also gone and cannot be listed.

**The rule that was missing.** A whole-file commit to the Mac is only safe when
the device copy is known to match the clone's base. From here: stage the device
copy of every file about to be written, diff it against the clone's base, and
merge before writing — not only for shared notes, which was the only file this
check had been applied to.
