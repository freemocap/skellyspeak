# Utility panel inventory

These adopted interactions govern the active UI. Inspection of reference source
informed the selection; active behavior is defined by the implementation.

| Surface | Implemented | Remaining dependencies |
| --- | --- | --- |
| Toolbar | Partner chooser, AI toggle, account/token status, reload, Settings, Profile | Ongoing narrow-window inspection |
| Settings | Search, section navigation, compact rows, automatic preference/key/model saves and backdrop dismissal, text scale/spacing/contrast, learner defaults, onboarding replay | Microphone selection, read-aloud/auto-send, editable shortcuts, distribution updates |
| AI access | Google system-browser sign-in/cancel/sign-out, quota report, explicit hosted/own-key selection; automatic key verification, green-check/red-X indicators, Show/Hide and visible save errors | Custom URL adapter, mobile sign-in, live route verification |
| Models | Hosted approved Standard model; own-key Standard/Fast configuration without key reentry | Evaluated Fast assignments |
| AI activity | Resizable dock, pop-out window, conversation/latest/recent selection, declared dependencies, attempts, models, usage, pause/step/cancel/retry | Selectable graph nodes, local prompt/result inspection and export |
| Profile | Retained totals globally, by language and partner; request/token/message counts and unknown usage coverage | Time series, distributions, source-linked assessment, CEFR, XP and Vibe |

Do not render pending functionality as working controls. Reports remain numerical;
absent skill evidence is explicit. Chat remains the main surface and lesson/analysis
the adjacent surface. Flowers visualize evidence only and do not define the app brand.

The voice-first chat composer and docked coach are integrated. Desktop hosted
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
| Glossing and word inspection | Not implemented | Tap/hold/focus reveals reusable source-bound meanings without re-requesting analysis |
| Translation/pronunciation/romanization | Preferences persist; annotated rendering absent | Same reading preferences apply to messages, coach, suggestions and detail surfaces |
| Suggestions and expression assistance | Freeform coach available; structured tray absent | Compact content-sized bubbles, distinct insertion action, no autosend, assistance attribution retained |
| Assessment and XP | Not implemented | Source → observation → eligible credit is inspectable; retries and repeated snapshots never duplicate rewards |
| Seven-domain skill map | Not implemented | A restrained category-fill view consumes versioned metrics, with no invented proficiency |
| Growing flower/garden | Not implemented | The same underlying evidence/metrics hydrate the flower; changing renderer changes no scores |
| Voice interaction | Desktop capture/transcription code exists; native end-to-end validation pending | Record/stop/discard, transcription, read-aloud and any auto-send behavior verified individually |

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
