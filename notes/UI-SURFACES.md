# Utility panel inventory

These adopted interactions govern the active UI. Inspection of reference source
informed the selection; active behavior is defined by the implementation.

| Surface | Implemented | Remaining dependencies |
| --- | --- | --- |
| Toolbar | Partner chooser, AI toggle, reload, Settings, Profile | Ongoing narrow-window inspection |
| Settings | Search, section navigation, compact rows, automatic preference/key/model saves and backdrop dismissal, text scale/spacing/contrast, learner defaults, onboarding replay | Microphone selection, read-aloud/auto-send, editable shortcuts, distribution updates |
| AI access | Google system-browser sign-in/cancel/sign-out, quota report, explicit hosted/own-key selection; automatic key verification, green-check/red-X indicators, masked key entry and visible save errors | Mobile sign-in, live route verification |
| Models | Hosted approved Standard model; own-key Standard/Fast configuration without key reentry | Evaluated Fast assignments |
| AI activity | Resizable dock, pop-out and mobile dialog; exchange selection, declared dependency graph, attempt states, models and reported token usage | Pause/step/cancel/retry and Recover access controls; selectable graph nodes, local prompt/result inspection and export; live native inspection of refusal recovery |
| Profile | Retained totals globally, by language and partner; request/token/message counts and unknown usage coverage | Time series, distributions, source-linked assessment, CEFR, XP and Vibe |

Do not render pending functionality as working controls. Reports remain numerical;
absent skill evidence is explicit. Chat remains the main surface and lesson/analysis
the adjacent surface. Flowers visualize evidence only and do not define the app brand.

The voice-first chat composer and docked coach are integrated. Desktop capability-routed
transcription inserts a draft; coach replies use durable separate graph operations.
Startup opens chat directly and new conversations require no title. Remaining lesson
parity includes source-linked word breakdowns, suggestion trays, lesson editing,
read-aloud, auto-send and the evaluated skill/evidence projections. These are not
represented by nonfunctional substitutes.

## Functional restoration checklist

The familiar interface is the required product surface, not a temporary shell to
replace with a different interaction model. Restore essentially the full set of
adopted chat/lesson interactions, checking each against explicit domain ownership.
Visual resemblance alone does not complete a feature.

| Capability | Current implementation | Completion check |
| --- | --- | --- |
| Partner/coach exchange | Separate persisted threads and gated Standard calls; OpenRouter partner reply confirmed in the live app; recorded hosted failures show HTTP 429 | Verify a live accepted reply and coach response; expose actionable hosted failure reasons |
| Tokenized message bubbles | Plain message text; source-linked token rendering absent | Exact original text, punctuation, Arabic/Chinese spacing, and repeated-word source identity preserved |
| Inline word glosses | Source implemented; hosted QA failed, diagnosis pending | Click/keyboard reveals saved meanings beneath exact words; unannotated text is inert; no empty detail modal |
| Translation/pronunciation/romanization | Preferences persist; annotated rendering absent | Same reading preferences apply to messages, coach, suggestions and detail surfaces |
| Suggestions and expression assistance | Freeform coach available; structured tray absent | Compact content-sized bubbles, distinct insertion action, no autosend, assistance attribution retained |
| Assessment and XP | Not implemented | Source → observation → eligible credit is inspectable; retries and repeated snapshots never duplicate rewards |
| Seven-domain skill map | Not implemented | A restrained category-fill view consumes versioned metrics, with no invented proficiency |
| Growing flower/garden | Not implemented | The same underlying evidence/metrics hydrate the flower; changing renderer changes no scores |
| Voice interaction | Desktop capture/transcription; durable metadata-only receipt displayed in AI activity; restart marks interrupted audio unknown without replay | Native record/stop/transcription smoke test pending; read-aloud and any auto-send behavior verified separately |

Next focus: diagnose hosted admission, prove one real exchange, then complete one
source-linked analysis path from reply to tokens/glosses and inspected bubbles.
Follow with suggestions, evidence/XP and both progress renderers. Continue refining
the familiar UI during these slices rather than declaring another visual redesign.

## Test reuse and gaps

Select reference test scenarios intentionally and adapt them to the active contracts.
Do not activate the archived suite wholesale: obsolete imports, ownership and mocks
would exercise a different application. Relevant reviewed examples include:

- `token-spacing.test.ts` and `source-token.test.ts`: punctuation, repeated words,
  Arabic/Chinese source reconstruction.
- `message-evidence.test.ts` and `skill-rewards.test.ts`: credited source ranges,
  exclusions and no repeated XP celebration from refreshed snapshots.
- `GuidedPage.conversation.test.tsx`: persisted chat restoration, reading preferences
  across surfaces, retained errors and attribution of inserted suggestions.

The active frontend suite exercises directory reconciliation, draft scope, rendered
key entry/save/error preservation, stale verification responses, model edits retaining
credentials and hosted/own-key refresh isolation. Add component/integration coverage for sending,
error visibility, settings saves, coach scope, recording controls and the restored
token/suggestion interactions as those paths are implemented. Provider mock tests
cannot establish account allowance or successful production inference.

AI access now includes independent Groq credentials and a custom URL form with
explicit bearer/no-auth and optional transcription capability. Native visual review
and live custom/Groq checks remain pending. Saved secrets have no reveal control.


AI access is a Settings section with Hosted sign-in / API keys / Custom URL tabs.
OpenRouter and Groq inputs appear consecutively; model preferences follow in a
closed disclosure. Hosted sign-in is the primary control, with usage and service
details secondary. API access has no toolbar button. No promotional headings or
redundant introductory copy. Keyboard tab navigation, save locking and key grouping
have component tests. Desktop and narrow layouts were inspected using real
components with isolated visual test data; native authentication is separate.

## Saved reply translation

Partner messages display saved translation beneath the source when the conversation
Translation preference is enabled. Pending/error state points to AI controls.
Toggling display or opening a surface never generates assistance. Eligibility is
captured at Send. Explicit failure retry operates on the failed task, not the reply.

## Conversation controls and contacts — current source

Difficulty is a compact five-choice dropdown beside Target/Explanation language, saved on the conversation through the native settings action; Beginner is the native default. The same assistance pipeline applies at all levels. Profile beside Lesson/Analysis edits the current contact with autosave. The Contacts drawer selects existing contacts, opens their conversations and exposes explicit Edit profile/New conversation actions. Selecting a contact never creates a conversation. New persona supports manual editing and generated proposals, followed by explicit Create. Generation is single-use, bounded and cancellable; pause and connection authority are rechecked throughout. Durable generation receipts and reported usage appear in AI activity, including cancelled/unknown outcomes. Only dispatched attempts enter generation usage totals. See workflow/reports/U1-contact-settings.md for source verification versus native QA.

Header density and AI-access draft recovery are recorded in workflow/reports/U1-header-access-correction.md. AI access retains failed drafts and offers explicit Discard changes without deleting saved credentials.

The chat header omits the visible Learning label; the target selector retains its
accessible name. Target language, difficulty and partner share a single grid row,
with the largest share reserved for the partner. Saving status remains announced
without consuming a selector column.

## Message revision — current source

Edit message prefills the composer and submits a native revision using the
exchange's durable identity. The latest exchange needs no removal confirmation;
an earlier edit names the later conversation and private-coach turns it removes.
A stale snapshot or pending reply rejects the action explicitly and retains the
draft. Delayed responses cannot overwrite another conversation's composer.

The revised exchange is the only active version shown in the conversation. The
chat does not display earlier-version history. Native revision records remain
retained for evidence and ownership checks; that retention is not a visible history
feature. Replaced exchanges do not feed current suggestions or automatic speech.
Revision rewards use only newly credited native XP, with assistance and
deduplication preserved.

GuidedPage tests cover the real revision handlers with native contract fixtures.
Historical wave-one verification, including the earlier history UI that has since
been removed, is recorded in `workflow/reports/coaching-w1-integration.md`.
That report does not establish current native/device or live-provider behavior.


## Coaching and conversation starts — wave-two source

Empty chats show one “You start” button and an optional topic dropdown, defaulting
to “Any topic.” Topic selection alone does not start a conversation. The composer
remains usable throughout. Cards, previews and the description form are removed
from the first screen. Partner-first starts create no learner message. Their
pending, paused and failed state remains visible before any reply exists.

Message chips open a compact coach card with exact source text, policy-selected
help, Edit & try again, Show answer and Keep going. Native Open card acknowledgement
records help exposure before displaying a hint. Pencil editing alone does not
reveal one. Numeric message grading is removed. Fixed notes require checked repair
evidence; uncertain checks explicitly say the repair could not be confirmed.

Configuration errors stop startup before normal store projections load, name the
file and require correction followed by a native restart. This screen offers no
data-deletion remedy. Retained observations from a changed construct registry have
an inspectable mapping notice, source quotes and registry identities. Existing data
copy exports database/supporting files only; factory reset also removes editable
configuration.

Production GuidedPage components were inspected with a test-only transport at
desktop and 360px Arabic/enlarged-reading widths. This is browser layout evidence,
not a live provider or native persistence session. See
`workflow/reports/coaching-w2-integration.md` for current verification status.

Arabic-script reading preserves each original orthographic word as one shaping
run, even when saved glosses divide it into clitics or morphemes. Word disclosure
shows the individual source fragments and glosses with their saved anchors.
Analysis sentences retain original punctuation and whitespace; they are never
reconstructed by inserting spaces between gloss tokens.

Requested message analysis shows language explanations immediately, with no nested
observation disclosure or internal counters/construct IDs. Correct forms carry
plain explanations of their use. Explicit answers show original → corrected
wording and the reason. The editing panel stays expanded and offers help/answer
controls in place. Requested analysis may select observed errors that automatic
interruption policy skipped; this disclosure is recorded natively. Historical
records with no explanation report that absence rather than inventing advice.

The latest exchange's coaching and saved language analysis appear automatically
beneath the skill map. The private coach follows each response; detailed XP
records sit in a separate disclosure. Visible hints record exposure through the
native coaching control; hidden or collapsed panels do not count as viewed.
Every message feedback button opens the same dialog, including no-correction
results and failures. Saved translations and word meanings remain inspectable.
Message actions follow expanding content in normal layout flow.

Suggested replies start collapsed behind “Show suggested replies.” Opening that
control explicitly requests generation; sending a message does not schedule
suggestion generation. Repeated requests share the existing operation.

Coaching review reuses saved interactive sentence text, including anchored Arabic
word groups, instead of separate vertical word/gloss lists. Learner and partner
reading blocks use blue and green accents; correction cues use amber. Compact
quote margins and panel spacing keep help beside the exchange. Both message
action rows use Translate then Analysis, aligned to the same bubble inset.

Partner replies receive a separate reaction evaluation after generation. An emoji
on the bubble opens the interpretation and its evidence; missing results do not
imply understanding. Reaction sounds respect existing settings. A failed coaching
review offers Retry failed help, using the bounded native turn retry: successful
reply/content remain intact and failed assistance operations are retried.

### Living Spectrum integration — 2026-09-13

Settings → Reading now includes Appearance (Dark / Light / System), persisted on
the native learner. System follows OS appearance. Desktop conversation/coach width
can be adjusted by dragging the separator or focusing it and using arrow keys;
Home/End choose the limits and double-click resets. Geometry stays presentation-only.
The same existing conversation, coaching, voice and reward components use both
palettes. See `workflow/reports/living-spectrum-integration.md` for verification.

### Transcription inspection

Recording keeps the live waveform. After successful transcription, Inspect recording
opens a separate dialog for the latest completed recording: waveform, spectrogram,
detected audio activity and available word timestamps share a time axis. Selecting
a word seeks playback, highlights its interval and exposes original/aligned timing
and available segment log probability, no-speech probability and token IDs.
Play/pause, restart, a position scrubber, timeline zoom, fit and optional playback
following share the same time axis. Unsupported
words remain in the transcript and are identified separately. A route without
timestamps explicitly shows their absence. The inspection is transient, cleared
on navigation, and remains independent of subsequent text edits. No raw audio is
saved; the latest WAV is returned for memory-only playback and released when
replaced or leaving the conversation. Closing the dialog stops playback.
Native rebuild required for playback audio and segment metadata.

### Learning evidence profile — 2026-09-13

Profile → Your learning evidence opens a separate detail view for the selected
language: partner and variety filters, registry-lens groups, independent/assisted counts, estimate and uncertainty,
last observed and review date, plus source-message inspection and reversible
attempt exclusions. Insufficient evidence is explicit. The existing activity/XP
view remains separate. Partner estimates are recomputed natively from matching
conversations. Archived partners remain selectable. Practice XP and YAML exports
are language-wide. Native rebuild required for `get_learner_profile`.

### Learning evidence export — 2026-09-13

Your learning evidence → View YAML opens a literal YAML preview; Save YAML writes a fresh native snapshot
for the selected language to Downloads. It includes source observations, focus and
exclusion choices, estimates and configuration hashes. The view's variety filter
does not restrict the export. The app reports the resulting path or a write error;
existing files are never replaced. Native rebuild is required for this command.

Conversation settings (gear) → Conversation YAML opens View YAML / Save YAML,
with independent unchecked options for coaching/private coach chat and backend
activity (models, requests and token use). The export contains the full active
transcript and excludes replaced messages. Each action reads current local data.
The preview scrolls within the dialog; saving reports the new Downloads path.
No AI request is made. These commands require a native rebuild.

## Language controls and localization

The native-language setting drives the shared UI translation context and locale
number/date formatting. Language selectors use configured endonyms and translated
configured names. All seven shipped languages appear in both roles. Variety
selection is limited to the chosen language's configured presets; unsupported
free-form varieties are no longer offered. Locale changes preserve component state.
German/light, Portuguese/narrow/dark and Arabic/narrow/RTL component fixtures were
inspected for this change; native session and provider evaluation remain separate.

### Explicit lessons

- **Take a lesson** beside **You start** and above the private coach input opens a
  modal with three topic suggestions, **Request a topic**, and saved lessons.
- The lesson shows its objective, short explanation and two translated examples;
  saved romanization/pronunciation follows reading preferences. Optional exercise
  and private coach questions are available before **Try it in chat**.
- Handoff returns mobile users to Chat. The coach area retains access and shows a
  concise completed-task recap; **End practice** leaves ordinary chat available.
- Failed generation preserves the topic and offers explicit retry. Source status
  and verification limits: `workflow/reports/lessons.md`.

Lesson chooser: Practical situations / Grammar / About the language / Reading, category-specific
suggestions and custom topic. Each saved lesson has an optional two-question
**Test your understanding** quiz with answer explanations and persisted 0/1 XP;
chat practice remains available without answering. Quiz XP is shown separately
in conversation and language statistics and included in total XP.

## Variety controls

Settings groups the target language with its Variety, then the native/explanation
language with its Explanation variety. Interface language is separate. A single
variety displays its name without a redundant selector; multi-variety choices are
localized and validated. The speech information control states that exact variety
matching is not guaranteed. Target-script direction, scale and romanization follow
the chosen variety. The no-starter state is explicit and leaves the start action
available. German/light and Arabic/narrow/dark/RTL isolated fixtures were inspected;
no native workspace was restarted for this change.
