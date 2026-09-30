# Conversation responsiveness and layout audit

Status: source audit dated 2026-09-29; presentation and speech-state checkpoints
and progress simplification are implemented below. The history-dependent local
publication wait is now removed; timing measurement and incremental audio delivery
remain proposals.
The pending-message work remains governed by its existing note; this audit
identifies remaining issues and does not supersede those decisions.

## Live-publication checkpoint

Implemented after approval of the local publication slice:

- Live conversation pages publish as soon as their read resolves, retaining
  already displayed history. The live watcher continues while older pages refresh.
- One background history walk runs at a time; additional refresh requests coalesce
  to the latest live page. Each returned page publishes independently and the
  full displayed range remains eligible for future refreshes.
- Message, turn and edit-count records retain their own revision stamps. A newer
  global snapshot revision does not make every cached record current; delayed
  pages can refresh old records without overwriting newer overlapping records.
- Chat/session checks, explicit read retry, bounded native reads and visible
  errors remain. A history refresh failure retains the published reply and stops
  observation until retry. No provider requests or retry policies changed.

Verification: 11 snapshot tests and 42 conversation-flow tests pass, covering two
live updates during a delayed history read, overlapping revision records,
multi-page gaps, history failure/retry and chat switches. Production build and
fast validation pass. These deterministic checks establish removal of the UI
dependency, not measured device latency or provider speed. No local server or
live provider request was started.

## Progress-feedback checkpoint

Implemented after approval of this slice:

- Pending replies show “Replying…” and switch to “Receiving reply…” when text
  arrives, instead of operation names, word counts and completion summaries.
- Composer admission says “Sending…”. Transcription and audio preparation retain
  their distinct labels.
- The initial “Background activity” link was rejected in review and removed.
  Ordinary follow-on work adds no composer label; failed and held work remains
  visible and inspectable. There is no three-second completion linger.
- The connected activity button has a rotating border highlight while the
  existing conversation activity signal reports running operations. It does not
  change button geometry. Reduced motion uses a static border; forced colors
  retain a visible outline. The signal still covers recorded operations in the
  open conversation, not every possible request elsewhere in the application.
- The coaching panel puts reply help below the selected partner message and
  exposes grammar and suggestion actions immediately. Selecting a message does
  not generate assistance. Older selected messages retain their own help and
  diagnostic context as newer exchanges arrive. Mobile composer help retains
  its separate compact disclosure. Message excerpts in the coach use green.
- After review, the coach's brief hint is hidden behind “Help understanding this
  message”. Only an explicit click reveals it; arriving data and opening grammar
  or suggestions do not reveal it. Those two actions stay visible independently.
  The disclosure can close again without collapsing the other help lanes.
- The activity view retains operation details and metadata. No scheduling,
  provider, retry, persistence or action-admission behavior changed.
- Human message text aligns right within its existing right-anchored bubble.

Verification: 64 focused conversation tests pass across five suites, including
send/edit transitions, streamed replies, immediate activity clearing and failure
discovery. These are source and automated checks; no running-app visual review
or live provider request was performed for this slice.

The review follow-up passed 85 tests across coaching, reply help, conversation
selection, status and top-bar suites, plus the production build and fast checks.
The in-app browser had no open preview; the local server was not restarted.
The hint-disclosure correction passed 61 reply-help and conversation tests, fast
validation and preview type checks; generated component artifacts were refreshed.

## Speech-state checkpoint

Implemented after approval of the next slice:

- Reply speech keeps request ownership separate from `idle`, `preparing` and
  `playing` presentation state. Ready/retained audio and failure diagnostics remain
  separately available. A pending operation does not provide enough information
  to distinguish queueing from synthesis, so the UI does not invent those states.
- The media player's actual `playing` event activates playback presentation.
  Creating a handle, receiving a file or resolving a play request does not.
  Waiting/pause events return the active request to preparation; completion, stop
  and failure clear it. These events establish media playback, not physical
  audibility through a muted or disconnected output device.
- The message's existing fixed-size control shows a spinner while preparing,
  announces “Preparing audio…” and offers “Cancel speech preparation.” It changes
  to the stop icon during playback. Both new labels exist in all seven UI locales.
- Message and expanded audio inspectors receive the same state. Opening an
  inspector during preparation no longer toggles/cancels the request, and the
  inspector does not call pending audio unavailable.
- Existing operation cancellation, generation guards, playback permits,
  microphone exclusion, revision ownership, error details and retained replay
  remain in place. Released media callbacks cannot reactivate a stopped request.

Verification: 101 focused tests across seven speech, player, reading-control and
conversation suites passed; the seven-test message-transition suite also passed,
including preparation through the actual message control and inspector opening.
Production UI build, fast validation, preview type checks and component preview
generation passed. Existing canvas-environment and bundle-size advisories remain.
No local server was started, no port was claimed, and no live speech/provider or
device listening check was performed. Changes remain uncommitted.

Manual review: request playback on an uncached reply, observe preparation before
playback, cancel during the wait, then retry explicitly. Open inspection while
preparing and confirm it preserves the request. This checkpoint improves feedback;
it does not reduce synthesis time or change the complete-audio delivery protocol.

## Stability and progressive-reveal follow-up

Subsequent visual correction: the partner reaction slot aligns to the bubble's
bottom edge again. Its reaction button is transparent and borderless, retaining
the icon, keyboard focus, detail action and a 44-pixel coarse-pointer target.
Style validation passed and the generated stylesheet was refreshed. The local
preview server remains stopped; this correction was not checked in a running UI.

User review found the first checkpoint still bounced and requested stable bubbles
that expand, plus word-paced display for both streamed and whole replies. This
explicitly revises the earlier presentation rule that all received text must be
painted immediately. Source records, diagnostics and usable controls remain immediate.

Implemented:

- Short conversations start at the top instead of an expanding bottom spacer.
  New content grows downward; existing tail-following and older-history anchoring
  still apply when the conversation exceeds the viewport.
- Conversation bubbles use stable lane widths. Admission fades without translating
  or scaling. The inline streaming caret no longer consumes space and wraps lines.
- Each mounted turn keeps a per-bubble height floor through automatic hydration.
  A bubble can grow but does not shrink as placeholders become results. Resizing
  its width or directly using its controls releases the floor; inspectors retain
  their explicit open/close behavior. The tradeoff is some retained blank space
  when a result is shorter than the space already allocated.
- Revisions retain their presentation slot across native acceptance. Record-owned
  controls reset inside that slot; old reading/inspection state is not attached to
  a new record. The revision-identity cache exists only in the mounted conversation.
- A bounded word reveal consumes live reply text and continues into the saved
  reply without replaying its prefix. Small deltas appear immediately; a stopped
  burst catches up within 800 ms. Whole replies use the same presentation when
  the turn was already awaiting a reply. Existing history opens fully visible.
  Reduced motion, source replacement and terminal failures show available text
  immediately. Unicode segmentation preserves source whitespace, combining
  sequences, joined emoji and scripts without spaces; no text is normalized.
- Known unrevealed text reserves its layout, so revealing words does not itself
  resize the bubble. Assistive technology receives the full available source;
  native completion, speech, actions and diagnostic availability are not delayed.
- Empty partner translations are treated as absent while queued/running, preserving
  the translation placeholder instead of inserting an empty completed translation.

Streaming source verification (no transport changes in this slice):

1. `native/src/application/scheduler.rs` prepares capability support, requests
   grouped deltas and forwards each accumulated text update into the native stream.
2. `native/src/ai/transport/grouped.rs` requests version-two deltas for prose only,
   when the server advertises support. Structured operations remain whole results.
3. `server/app/main.py::stream_grouped_item` sets upstream `stream: true` and
   forwards parsed text deltas before returning the completed result.
4. `native/src/application/streams.rs` pumps changed entries at 50 ms intervals;
   `ui/src/state/session/attempt-streams.ts` subscribes and reconciles them with
   snapshots. `TurnView` consumes these updates before saved assistant text exists.

This verifies the implementation path, not the capability or latency of a live
configured service. Older/custom endpoints without advertised support still use
whole results. A cold capability probe is another existing request boundary;
it was not changed here. No paid provider requests or deployments were performed.

Review the same transition fixture, now with **Delivery: Streamed chunks / Whole
response** and a **Long reply** sample. Streamed fixtures enter through the real
attempt-stream store; all data remains local and synthetic. A new sample resets
the presentation scenario instead of inheriting another sample's height floor.

Browser checks: wide learner and partner bubbles both stayed 688 CSS pixels wide.
The learner's top stayed at 109 pixels through queued and completed stages;
annotation growth moved only subsequent content downward. At 390-pixel width and
150% reading size, mixed-script streamed and saved replies retained the same left
edge (495 pixels), top (312.313 pixels) and width (280.797 pixels). A whole-response
long reply visibly retained an unrevealed tail during the paced display.

Verification: the focused conversation/message/reading/stream suites passed
154 tests across 15 files. A subsequently added component-level live-to-saved
reveal regression also passed with its full six-test suite (155 distinct tests
across the combined runs). Production build, preview types, fast validation and
generated design-system checks passed. Existing canvas-environment and bundle-size
advisories remain. No native/server code changed; transport conclusions above
are source inspection, not a claim that transport tests or live calls were run.

Limits: "stable" means stable lane width, growth direction and retained allocated
space, not absolute pixel immobility. Longer annotations can rewrap words, previous
messages growing can move later ones down, and tail-following scrolls long replies.
Native listening checks, real service timing, coarse-pointer device verification
and a full application usability review remain separate. Stop for user review here.

## First stage-one checkpoint (prior review)

Implemented at the first checkpoint: send/edit transitions and reading-aid
reservations. User review requested the follow-up above. Changes are
uncommitted; no deployment or native/provider contract changes were made.

- Pending edits keep the existing turn component and editing marker, display the
  submitted wording immediately, and do not force a jump to the conversation tail.
  The learner bubble's contents still switch between pending and saved renderers;
  this is not a claim that every descendant DOM node is preserved.
- Pending messages reserve the learner feedback row, partner reaction gutter,
  translation slot and toolbar footprint. Reserved controls are hidden and inert;
  progress occupies their place. Editing does not repeat the entrance animation.
- Reading rows reflect enabled translation and pronunciation/romanization aids.
  Partner reservations persist through ready, dependency-waiting and running states.
  The policy uses reading capabilities and preferences, not language branches.
- Toolbar fitting reads untransformed, fractional layout widths. Measuring an
  animated bounding rectangle had underestimated the available tool footprint,
  causing an extra wrapped toolbar row at the pending-to-saved handoff.

Review artifact: run `npm run dev`, then open
`http://127.0.0.1:1420/tools/conversation-transitions-preview.html`. Select Send or
Edit, choose a delay, and run transitions or step through the Stage control.
This deterministic fixture uses real message components with sample data. It
does not execute native admission, recording, provider requests or speech playback;
full-page send/edit ownership is covered separately by the regression suites.

Browser verification in the fixture:

- Wide, 100% reading size, translations enabled: learner and partner bubbles each
  remained 116 CSS pixels tall between submitting and saved/queued states.
- Narrow (390 CSS pixels), 150% reading size, mixed scripts, translations and
  pronunciation enabled: both bubbles remained 168.297 CSS pixels tall through
  submitting, saved/queued and running stages. Learner width stayed 279 pixels;
  partner width stayed 284.906 pixels. The feedback-row height stayed 37 pixels.
- Completed aids remained readable with overflow actions reachable and the
  composer reference stationary. Completion still changes height when actual
  translations wrap or word annotations need more room. Mixed-direction plain
  text and segmented annotations can also differ visually; exact glyph/line
  continuity is not established by these checks.

Automated verification: focused conversation, message, reading and toolbar suites
pass (138 tests across 11 files), including pending edits, rejection, earlier-history
scroll position, aid phases and hidden pending controls. Fast validation, production
UI build, preview type checking and generated design-system consistency pass.
The existing canvas test-environment notice and build chunk-size advisory remain.

Limits: these are component geometry checks and automated behavior tests, not a
measurement of live end-to-end latency or native application usability. Coarse
pointer and reduced-motion device checks remain outstanding. Existing large
conversation files were kept in place for this bounded behavior change; their
decomposition is a separate responsibility review. Later audit findings below
describe the pre-implementation source baseline unless addressed above.

## Conclusion

The conversation already overlaps substantial work. The largest immediate UX
opportunity is continuity: acknowledge the action locally, keep the same message
and controls in place, and let independent results become usable separately.
Adding more loading animations would not resolve the identified discontinuities.

Voice has a real serial path: a stopped recording must become a transcript, the
reply must finish, and a complete speech file must arrive before playback starts.
Improving that path requires both clearer intermediate states and, eventually,
an explicitly designed incremental audio delivery flow.

## Evidence and limits

- Read current conversation UI, reading renderers, recorder and speech player,
  native turn declarations, revision acceptance, dispatch and publication,
  snapshot observation, and server grouped and audio delivery code.
- Inspected the existing conversation layout fixture in a browser at 1280 by 720.
  This uses production components and sample data. It does not exercise real
  request timing, the full page send/edit handler, or native recording.
  Fixture-only unavailable-operation notices are not evidence of app failures.
- Ran the root fast validation gate and five focused UI suites: **69 tests passed**.
  Suites cover conversation actions, pending bubbles, scrolling, snapshot paging
  and speech ownership. The test environment also printed its existing missing
  canvas implementation notice; these tests do not validate waveform rendering.
- Initial sandboxed test startup failed because the bundler could not resolve
  its configuration through restricted parent directories. The same tests passed
  outside that restriction. The temporary frontend preview also ran successfully.
- No provider timing measurements, native app walkthrough, mobile geometry tests,
  or screen-reader tests were performed. Reported waits of one to eight seconds
  are the learner's observation, not benchmark results from this audit.

## Current request dependencies

Typed send first creates a display-only pending message. Settings/persona saves,
if present, finish before command acceptance. Native storage then accepts the
message and creates operation records. The UI observes the saved turn separately.
The local context operation releases these independent lanes:

- Partner reply, whose prose can stream before final publication.
- Learner translation and learner word glosses.
- Coaching, skill assessment and conversation feedback.

The completed, validated partner reply releases partner translation, word
glosses, reaction, reply brief and optional speech. Skill attribution follows
skill assessment. Detailed reply suggestions and explanations are explicit work.
They are not all precomputed simply because their operation records exist.

For voice input, recording finalization and transcription precede the normal send
path. For voice output, speech synthesis follows the completed reply; playback
consumes a complete WAV returned through the service, native storage/cache and IPC.

Evidence: `native/src/conversations/turn_plan.rs`,
`native/src/conversations/execution/{dispatch,publication}.rs`,
`ui/src/platform/audio/useMicRecorder.ts`,
`server/app/inference/audio_service.py`,
`native/src/ai/transport/service_audio.rs`,
`ui/src/platform/audio/speech-player.ts`.

## Findings and recommended changes

### 1 Preserve the edited message and its reading position

**Confirmed in source and regression tests:** `submitText` holds the edited text
before awaiting saves or command acceptance. Native revision acceptance writes
the replacement without waiting for a provider reply. The current checkout
therefore already implements immediate edit feedback. The reported delay needs
reproduction against the actual running build; do not reimplement that feature
on the assumption it is absent.

There are nevertheless concrete discontinuities. The page substitutes an entire
`PendingTurn` for the edited `TurnView`, removing the previous reply, tools and
feedback. Every new pending key also calls `jumpToLatest`, including an edit to
an earlier turn. The temporary edit wrapper lacks the original `data-editing`
marker, so the stream's editing CSS can dim it as though it were unrelated.
Accepted edits remain in edit mode until the replacement snapshot arrives.

**First priority proposal:** preserve one visible turn shell and anchor the edited
message. Update its learner text and show a local revision state immediately.
Retire dependent content deliberately after acceptance, with old content clearly
identified as superseded if temporarily retained for continuity. Keep failure
recovery and the existing earlier-turn removal confirmation. Never leave an old
reply looking like the answer to the new wording. Do not jump to the conversation
tail for an edit unless the edited turn is already there.

Owners: `ui/src/features/conversation/ConversationPage.tsx` (`submitText`, pending
key effect and active-turn rendering), `messages/PendingTurn.tsx`,
`native/src/conversations/revision.rs` (`accept`).

### 2 Make pending and saved bubbles use consistent geometry

**Confirmed source mismatch:** the learner `PendingBubble` is rendered without
`aids` or `translationSlot`. The saved learner message can immediately reserve
gloss pitch and show a translation placeholder. A fast local acceptance can thus
produce two different layouts before the provider has answered.

The partner placeholder reserves reading aids whenever preferences request them.
Its saved replacement reserves aids only when `segmentsPending` is true, while
`TurnView` passes true only for the `running` gloss state. Ready or dependency
waiting states can therefore lose the reservation, then regain it at dispatch.
The saved partner wrapper also has a reaction gutter absent from `ReplyStatus`.
Measure its exact contribution at each width rather than assuming pixel parity.

**First priority proposal:** use the same shell, width rules, footer footprint,
reaction space and aid-reservation policy for pending, streaming and saved
messages. Reservation should cover all states in which a requested aid is still
expected. Preserve reduced-motion behavior and avoid replaying entrance motion
when ownership changes from temporary to durable data.

Owners: `messages/{PendingTurn,PendingBubble,ReplyStatus,TurnView}.tsx`,
`ui/src/components/reading/TargetMessage.tsx`, conversation `messages.css`.

### 3 Reading aids can still move already readable text

**Confirmed mechanism; magnitude unmeasured:** the current aid reservation adds
one gloss row to plain-text line pitch. Saved inline glosses can widen tokens,
change line breaks and add romanization/pronunciation rows. A translation slot
reserves one line even when the eventual translation spans several. The CSS
already acknowledges the word-width limitation.

**Proposal:** preserve source wrapping where feasible; put variable-length
secondary content in a consistent region. Keep the learner's enabled reading
aids. Do not silently turn them off to achieve a stable layout, clip long text,
or delay readable reply text until every aid finishes. Prototype long glosses,
mixed scripts and large reading sizes before selecting the exact inline layout.
For genuinely unknowable content height, allow growth while preserving the
reader's anchor rather than promising zero height change.

Owners: `ui/src/styles/components/reading.css`,
`ui/src/components/reading/{SavedGlossText,TargetMessage,TranslationStatus}.tsx`.

### 4 Separate preparing speech from audible playback

**Confirmed:** `useMessageSpeech.start` sets `messageId` before generation or
audio retrieval completes. `ConversationPage` maps that identity to both
`speaking` and inspector `playing`. The same control can therefore look active
through a silent network wait. `consume` polls pending audio every 400 ms.

**First priority proposal:** represent requested/queued, preparing, ready,
playing, stopped and failed distinctly. Use a stable button footprint; a pending
stop action should mean cancel preparation, and a playing stop action should
stop playback. Preserve ownership checks that prevent late audio playing after
navigation, microphone capture or revision. Announce a small number of meaningful
state changes rather than every poll.

This improves clarity without shortening synthesis. For actual latency, first
measure reply-complete to speech-start and audio-ready to audible-playback.

Owners: `speech/useMessageSpeech.ts`, `ConversationPage.tsx`,
`ui/src/platform/audio/speech-player.ts`.

### 5 The main reply is already independent of background analysis

**Confirmed:** turn declarations do not make partner reply depend on coaching,
learner translation or glosses. Dispatch prioritizes context, replies and speech.
The scheduler groups compatible work without a deliberate batch-fill timer;
server grouped execution starts sibling tasks concurrently and emits individual
results. UI tests verify that an assisting turn does not block the next reply.

Keep these properties. The shared native pool has 32 slots and does not preempt
already running work. Saturation can still delay foreground requests, but this
audit did not establish saturation as the source of ordinary waits. Measure queue
time before adding capacity or changing concurrency policy.

Owners: `native/src/conversations/execution/dispatch.rs`,
`native/src/application/scheduler.rs`, `native/src/ai/policy/admission.rs`,
`server/app/inference/grouped.py`.

### 6 Snapshot delivery creates an avoidable history dependency

Historical finding, addressed by the live-publication checkpoint above.

**Confirmed:** after older messages have been revealed, every new snapshot
revision sequentially rereads the revealed older pages before calling
`setSnapshot`. A new visible turn or revision is consequently held behind local
history reads. This is not a provider dependency, but it scales with history depth.

**Proposal:** publish the current tail promptly and reconcile older pages
separately, with explicit revision/deletion semantics. Preserve the current
protection against missing middle pages and resurrecting removed revision suffixes.
Simply merging stale pages sooner would be incorrect.

`useConversationDetails` also rereads the workspace on every snapshot revision,
and `useConversation` requests a skill-evidence reload. Evidence reloads already
coalesce; these are amplification candidates, not proof of a slow frame. Profile
before changing invalidation scope.

Owners: `session/{useConversationSnapshot,useConversationDetails,useConversation}.ts`,
`ui/src/state/learning/skill-evidence.ts`.

### 7 Expose progress in terms of the current action

**Confirmed:** `ActivitySummary` shows internal operation names, operation counts,
words received and recent completions. The composer's summary lingers for three
seconds after all operations settle. This is useful inspection data, but can make
the conversation appear unfinished after its reply is already usable.

**Proposal:** the main message should communicate its own state: sending,
transcribing, receiving a reply or preparing audio. Keep full operation details
in the existing expandable activity surface. Distinguish background assistance
from permission to continue. Operation counts are not a reliable estimate of
remaining time because operations have different durations and dependencies.

Owners: `ui/src/components/feedback/ActivitySummary.tsx`,
`messages/TurnActivityLine.tsx`, `ui/src/domain/conversation/activity-summary.ts`.

### 8 Preserve useful action during waits

**Confirmed:** typing a draft remains possible during a pending reply, but sending
and microphone capture are disabled. The composer is already more permissive
than a whole-screen lock. Voice users have fewer useful actions while waiting.

**Proposal:** keep reading, navigation, drafting and independent inspection
available. Review a deliberate interrupt-and-revise interaction for voice before
allowing a second recording or queued send. Define which reply it replaces and
when audio stops; simply removing disabled flags risks ambiguous turn ownership.

Owner: `composer/ComposerInput.tsx` and conversation send/recording coordination.

### 9 Reduce local delivery delay after measuring it

**Confirmed:** native scheduling sleeps 100 ms between passes, conversation
observation checks revisions every 150 ms, and pending audio reads wait 400 ms.
These are separate polling intervals, not a measured sum or a guaranteed worst
case. They can add latency after work is already ready.

**Proposal:** instrument readiness and observation boundaries, then consider
event-driven wakeups with reconnection/reconciliation. This is secondary to the
seconds-long voice chain and the visible state handoffs.

### 10 Treat incremental voice as a separate product pass

**Confirmed:** the current service response contains a complete audio file; the
player cannot start from the first audio bytes. Automatic speech requires the
published reply as its source. Faster rendering alone cannot remove these waits.

**Later proposal:** evaluate incremental audio delivery for a completed validated
reply first. It could reduce time to sound without speaking provisional text.
Synthesizing sentences before the reply finishes is a larger decision: it affects
text finalization, pronunciation across boundaries, interruption, revisions,
alignment, caching, accounting and failure handling. Do not introduce that change
as a cosmetic fix. Partial transcription similarly needs a clear distinction
between provisional words and an accepted transcript.

## Guidance applied to this app

Nielsen's approximately 0.1, 1 and 10 second thresholds describe immediate
feedback, flow and sustained attention. They are design heuristics, not measured
limits for this app. Local acknowledgement should be immediate even when remote
completion cannot be. [@nielsenResponseTimes1993]

Progress feedback reduces uncertainty. For unpredictable inference, use truthful
stage labels and usable partial results; do not invent percentage completion or
a countdown. Keep short waits visually quiet and make prolonged waits explainable
and interruptible where the operation supports it. [@sherwinProgressIndicators2014]

Reserve space for known late-arriving regions, and avoid collapsing it between
loading phases. Exact reservation is impossible for arbitrary text. Measure
post-interaction shifts, not only initial page load; the standard CLS metric
excludes some shifts shortly after input and cannot alone establish a comfortable
chat reading experience. [@webdevLayoutStability]

Expose significant status changes to assistive technology without moving focus.
Avoid overlapping live announcements from multiple loading indicators.
[@w3cStatusMessages]

## Proposed implementation order

1. **Stable send and edit transitions:** shared shell geometry, persistent edit
   anchor, correct pending-edit styling, aid reservations through all pending
   phases, and explicit acceptance/failure behavior. This is the first recommended
   implementation slice; preserve existing immediate-feedback behavior.
2. **Honest voice and progress states:** separate preparation from playback,
   simplify primary progress while retaining diagnostics, and keep controls stable.
3. **Responsive local publication:** measure snapshot/history reads and queue
   delays, then remove demonstrated avoidable dependencies and excessive rereads.
4. **Incremental voice design:** choose user-visible interruption and source
   finalization behavior before selecting new transport/provider contracts.

Organize the first slice around message presentation and pending-action ownership,
within the existing feature folders. Extract only the coordination needed for
these behaviors; a broad folder reshuffle is not a responsiveness fix.

## Verification required for implementation

Build a deterministic transition fixture using the real page/components and
mocked boundary events. The current static fixture cannot validate these handoffs.
Exercise 0.1, 1, 4 and 8 second delays independently for acceptance, transcript,
first text, final reply, translation, gloss and speech; include failure and
out-of-order completion. These are test inputs, not expected provider timings.

Cover new send, latest and earlier edit, transcription with auto-send on/off,
retry, switching chats mid-request, cancellation, deep loaded history, keyboard
and coarse-pointer controls, narrow and wide screens, large reading size, mixed
scripts, canonical encodings and reduced motion.

Record action-to-first-painted acknowledgement, transcript readiness, first
readable reply, final reply, speech readiness and first audible playback
separately. Attribute each span to local admission, queue, provider, validation,
publication or UI observation. Retain operation/request identities and safe
metadata; exclude prompt, transcript, audio and credential content from timing logs.
Report medians and upper percentiles only after obtaining a defined sample.

Proposed acceptance targets:

- Local acknowledgement within 100 ms on target devices; this is a target,
  not an established result.
- No blank interval, duplicate bubble or repeated entrance animation during
  temporary-to-saved handoff.
- No forced tail jump when revising earlier history; keep the edited source
  and the reader's anchor stable through acknowledgement.
- No collapse-and-regrow cycle for requested aid slots; no moving Send/Record
  controls caused solely by secondary results arriving.
- Distinguish natural content growth from displacement of already-read text;
  record anchor movement as well as CLS.
- Background assistance does not disable another permitted user action.
- Pending speech is visibly different from audible playback, and late results
  cannot restart audio after stop, navigation or revision.
- Failures retain draft/source ownership and useful diagnostics; no automatic
  repeat of uncertain paid work.

Existing regression tests protect much of the state behavior. Browser geometry,
actual native event timing and listening checks are still required before calling
the app smoother in use.
