# Message edits and coach history — September 21

## Observed failure

Read the local application's metadata-only attempt receipts and local server logs.
At 13:13:54 UTC, a `conversation_feedback` attempt on a replacement turn failed
with `Conversation support: invalid or duplicate correction`. The provider returned
a complete `stop` response and retained usage; server operations completed. The edit
itself had been accepted. This was local feedback validation, not a duplicate
message/database conflict or failed provider HTTP request.

The old check combined unchanged corrected wording, repeated source phrases, and
invalid correction kinds under one error. Failed response content was intentionally
not persisted, so the exact subcondition cannot be reconstructed from that receipt.
There were older skill-assessment `Invalid decisions input flags` failures through
13:03:51 UTC, but none in the current server run's inspected logs. They are separate
from the feedback failure and are not claimed fixed by this change.

## Implemented behavior

- Feedback preserves valid overlapping, duplicate and unchanged suggestions rather
  than rejecting the entire feedback response. Existing source-quote, type/size,
  score and correction-kind validation remain. An invalid kind now names its array
  index, field and expected values in both the error and structured diagnostics.
- An earlier-message edit still regenerates the dependent persona suffix, but
  private coach turns and their receipts survive. One captured removal set drives
  receipt, evidence-exclusion and turn cleanup so their scope cannot diverge.
- Coach prompts include a `messageEdits` list of recent before/after versions,
  derived from the already retained revision chain. No competing edit-event store
  or duplicate inference operation is introduced. Historical wording is explicitly
  distinguished from the current message and new learning evidence.
- The revision confirmation says private coach history is kept. Current-source
  authority, action deduplication, late-result invalidation and credit rules remain.
- This user instruction supersedes the older coach-suffix deletion contract; the
  maintained coaching contracts now record that change.

## Verification

Native suite: 496 passed, five ignored before an additional edit-to-coach prompt
regression. That regression passes and verifies old private dialogue plus both
message versions reach the next coach request. Feedback tests accept overlapping
and unchanged suggestions but retain actionable errors for invalid fields/quotes.
UI conversation suite: 30 passed. TypeScript passed. No live app data was mutated,
provider call retried, commit created, or server deployed. Native source requires
a rebuild/restart before existing desktop/phone installations use the fix.
