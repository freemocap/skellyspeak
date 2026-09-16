# Model selection and AI access separation

Implemented source changes, September 16, 2026. No deployment or installed-app
rebuild was performed. The user's decision is that model selection is independent
of Hosted, API keys and Custom URL access. Provider availability is decided by the
provider, not by an application model catalog.

## Diagnosis

- Persisted Standard, Fast and Transcription choices were already global in
  `ai_config`; switching routes did not select separate model preferences.
- The UI nevertheless embedded the Models editor inside SettingsAccess, under
  whichever access tab was selected. Tests explicitly enforced that placement.
- Grouped server execution special-cased `openai/gpt-oss-120b` to Groq, with
  model-specific reasoning/schema adaptation. Other text models went to OpenRouter.
  The ordinary chat endpoint already used OpenRouter for all model names.
- Server contracts attached provider price ceilings derived from model IDs or a
  low default. These could exclude otherwise available models.
- Settlement treated actual cost above the reservation as a provider violation,
  failed the request and persistently blocked service spending.

## Implemented behavior

Settings has peer Models and AI access sections. The model editor reads shared
configuration and uses `save_models`; it does not load access settings, inspect
credentials, select routes or verify provider support. The access editor contains
no model controls. Their revisions refresh after either editor saves, including
mobile layouts where both remain mounted; writes are serialized in the modal.

All server text requests, grouped or ordinary, forward the selected ID to
OpenRouter without model-specific provider dispatch or schema rewriting. The server
adds no provider price filter. Transcription continues to forward the selected ID
to Groq. Model recommendations remain recommendations. Native model ID validation
now allows identifiers beyond the old ASCII punctuation subset; basic nonempty,
length and whitespace/control validation remains.

Actual reported text cost settles even above its estimate. Subsequent admissions
use the corrected balances. Account/global quotas, request bounds, authentication,
unknown-charge retention and explicit operational spending blocks remain. No
existing persistent operational block was cleared. Reservations are estimates:
in-flight requests may overshoot an allowance. Transcription still uses the existing
duration estimate rather than model-specific actual pricing.

Provider error codes and HTTP status are surfaced using the existing redacted
error path. Raw provider bodies are not displayed. There are no automatic retries.
Read-aloud still uses its existing fixed model on every access route; this change
separates the existing three learner-editable model choices and does not introduce
a new speech-model preference or change the workspace schema.

## Verification

- Server suite: 284 passed, 7 Firestore-emulator tests skipped. Controlled upstream
  tests cover arbitrary model IDs, provider errors, unchanged schemas, uniform
  credentials and successful settlement above the reservation estimate.
- Focused UI suites: 33 passed, covering access, separate model editing, save
  failures/discard and settings search separation.
- UI production build and language checks passed using Node 24.15.0. Existing
  large-bundle warning remains. Initial default Node run could not load jsdom;
  rerunning with the repository-required Node 24 resolved it.
- Rust formatting check passed. Native connection tests could not compile because
  concurrent language-content work in `native/src/configuration/inspection.rs:221`
  indexed a String-keyed map with DefinitionId. That unrelated code was untouched.
- No live provider requests, deployment or running native-app visual verification.

Existing unrelated working-tree changes were preserved. No commit was created
because this workspace contains substantial concurrent edits, including files
shared by this change.
