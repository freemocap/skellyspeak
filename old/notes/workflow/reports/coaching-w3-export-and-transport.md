# Autonomous follow-up: transport verification and evidence export

Completed without user testing, live inference, Git writes, or app/server restart:

- Audit follow-up tests exercise system → assistant opening → negative user answer
  through native grouped HTTP and Python forwarding, alongside an unrelated helper.
  Tagged out-of-order responses remain attributed to the original operation/attempt.
  No additional synthetic turns or production prompt changes were introduced.
- Removed obsolete visible-history promises from revision confirmation and docs.
- Added Save learning evidence to the profile. Native code computes a fresh scoped
  learner-state projection and exclusively creates a YAML file in Downloads.
  Export is not restricted by the view's variety filter. The UI reports the path or
  failure and ignores late export results after a language switch.

Verification: 586 frontend, 303 native tests pass (one live test ignored); 39 server
grouped/contract tests pass. Focused export tests cover source/provenance YAML round
trip, collision preservation, missing destination errors, correct language scope,
failed writes and stale language responses. Build, styles, generated contracts and
Clippy checked. The existing profile layout is reused; this slice has no new native
or device visual claim.

The observed self-answering is still unresolved at the deployed provider/semantic
boundary; deterministic transport tests are not evidence that model behavior is
fixed. See conversation-wiring-audit.md. Remaining Wave 3 work includes lens/partner
profile summaries, broader choice export, fluency, goals/reviews and milestones.

## Conversation export and YAML preview follow-up

Implemented Conversation settings → Conversation YAML with separate View YAML
and Save YAML actions. The complete active transcript is serialized natively;
replaced messages are excluded. Independent opt-ins add coaching observations,
decisions and private coach chat, or backend operation/attempt/model/token/version
metadata. Raw context, credentials and provider payloads are excluded. Neither
action invokes AI. Save exclusively creates a new Downloads file; preview renders
literal, selectable YAML in the app. Learning evidence now also offers View YAML
alongside Save YAML. Each action reads fresh saved data.

Verification: 591 frontend and 306 native tests passed (one live test ignored).
Build, styles, generated contracts, Clippy and diff whitespace checks passed.
Coverage includes all four export-option combinations, transcript pagination,
superseded and unrelated data exclusion, file collision preservation, preview
escaping, native errors and stale option/language results. The new native commands
require an app rebuild/restart; no device or running-app visual verification was
performed in this follow-up. This does not complete the remaining Wave 3 work.
