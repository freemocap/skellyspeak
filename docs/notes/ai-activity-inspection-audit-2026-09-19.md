# AI activity content inspection audit

Status: source audit and implemented UI changes, 2026-09-19. No deployment.

## Observed retention boundaries

| Path | Retained content / behavior | Owner |
| --- | --- | --- |
| Conversation request | Serialized role/content messages saved locally before dispatch; returned without diagnostic redaction | `native/src/conversations/execution/dispatch.rs`, `snapshots.rs` |
| Completed conversation response | Original completion text saved separately from diagnostics, before publication validation; includes text that later fails validation | `native/src/conversations/execution/publication.rs` |
| Streaming, cancelled and failed attempts | Live preview, periodic retained preview and final retention allow inspection of received text | execution publication and attempt-body tests |
| Diagnostic metadata | Content and credentials deliberately removed; provider IDs, model, usage, finish/validation metadata retained with bounds | `native/src/diagnostics/response.rs`, provider response adapter |
| Persona generation receipts | Status/usage/diagnostics; no separate request/response body contract for the activity viewer | `native/src/partners/generation/generation_receipts.rs` |
| Transcription receipts | Diagnostic receipt; transcript managed separately, no equivalent request/response body contract | `native/src/speech/recording/transcription.rs` |
| Speech output | Audio uses its own cache; it is not a prose response body | speech cache and execution speech |

Diagnostic metadata and local content are different records. Removing global
redaction would expose content in logs without solving missing local body storage.
The AI viewer must read the dedicated body fields. Credentials and HTTP headers
are not part of the conversation request-message inspection contract.

## Implemented

The main inspector now exposes both request and response, using the same component
as the full detail dialog. Readable is the default; Source displays the original
recorded strings. Structured JSON becomes labeled fields and lists; JSON inside
prose is also expanded. Long single-paragraph prose receives sentence paragraph
breaks for presentation only. Existing multiline Markdown stays intact. No model
summarization or prompt changes are involved. All keys and scalar values remain
available, including null/false; deep structures fall back to complete source.
Incomplete streamed JSON remains text until complete. HTML renders as inert text.

The inspector divider supports pointer and keyboard resizing and remembers its
width locally. Narrow windows stack the panes. Text wraps in both modes. Response
content uses the inspector scroll instead of a small nested scroll box. Diagnostic
metadata is separately labeled, with an explanation of its redaction boundary.

## Remaining retention gaps (not implemented by this UI change)

- Persona-generation and transcription receipts need separately designed body
  storage/contracts before their actual request/response can appear here.
- Failures before a provider response becomes a decoded Completion do not generally
  retain the raw response body for local inspection. Diagnostic metadata survives,
  but missing text cannot be reconstructed from redacted metadata.
- Retained conversation response/preview text is capped at 256 KiB at a UTF-8
  boundary. The current body contract lacks an explicit truncation marker.
- Provider reasoning and arbitrary raw provider envelopes are not synonymous with
  the retained completion text; Source means recorded content, not a full HTTP capture.

## Verification

- 72 frontend tests passed across activity, architecture and Markdown suites.
- 7 native attempt-body tests and 2 diagnostic-redaction tests passed, including
  explicit proof that inspectable request/response content survives while metadata
  redacts content and credentials and preserves provider identifiers.
- Frontend production build, localization checks, style checks and preview
  TypeScript checks passed. Existing bundle-size warning remains.
- Browser fixture (`ui/tools/activity-preview.html`) visually checked at narrow
  and desktop widths: paragraph spacing, embedded JSON fields, Markdown response,
  wrapping, original Source toggle, keyboard divider resize (40 to 44 percent).
  Fixture uses production components with synthetic data; this is not a live
  provider request or a verification of the native application window.

## Failed-node inspection follow-up — 2026-09-20

Observed in the local workspace through read-only SQLite queries:

- At 20:00:24 America/New_York (2026-09-21 00:00:24 UTC), user word gloss
  received a provider choice error with code 429: Google Gemini 2.5 Flash was
  temporarily rate-limited upstream. The saved summary was
  `gloss_invalid_termination`; the more useful provider reason survived in
  redacted response diagnostics.
- The simultaneous skill assessment used Gemini 2.5 Flash Lite and returned
  quotes absent from the current learner message. Native source binding rejected
  the assessment. An earlier assessment at 19:57:47 failed because one duplicate
  judgment changed the capitalization of its quote. Validation checks every item
  before duplicate consolidation, so the invalid duplicate still fails the result.
  Neither case justifies weakening evidence validation.
- The UI rendered attempt errors after request/response bodies and retained the
  previous node's scroll offset. Long prompts could therefore hide the explanation
  when a failed node was selected.

Implemented: shared failure presentation at the beginning of both the selected
operation inspector and full detail dialog, with recognized provider error
messages/codes from already-redacted metadata. Failure diagnostics are expandable
before facts and bodies. Selecting another operation/attempt or changing attempt
state resets the docked inspector scroll. Full diagnostic records remain available.
No provider calls, retries, assessment-policy changes or application-data writes
were made during this investigation.

Verification: 38 activity/graph architecture tests passed, including selecting a
failed node after scrolling, showing its retained 429 reason before a long request,
and displaying the same reason in full view. TypeScript and the frontend production
build passed; the existing bundle-size warning remains. This verifies source and
automated behavior, not a visual check in the running native application.
