# Connection and explicit retry audit — 2026-09-20

## Diagnosis from source

The screenshot's “Speech connection changed. Start a new exchange.” is a native
pre-request rejection. `request_speech` compared the original text turn's captured
AI-settings revision with the current global revision. This was not an endpoint
error or evidence that an HTTP connection broke. Model edits, route changes and
credential changes all advance that revision. The screenshot alone does not
identify which settings action triggered this incident. No live private logs or
application database were read for this source-level diagnosis.

The same mistake also affected cached speech reads and completion, explicit word
gloss retries, whole-turn retries, grouped dispatch preparation and microphone
transcription. Separate explicit retry checks imposed a lifetime 16-attempt budget
on text turns/glosses. The earlier uncommitted speech change already removed its
three-attempt and turn-budget limits; this work preserves it.

## Implemented

- Resident speech and active duplicate requests validate source ownership without
  requiring today's settings to match historical settings. New synthesis resolves
  current speech access while preserving saved source text, language and voice.
- Explicit gloss and turn retries capture current targets per operation. Original
  turn context and running sibling targets remain intact. Dispatch uses each
  operation's target consistently for route, credential and model.
- Explicit retries no longer consume a lifetime allowance. Queue capacity,
  provider refusal holds and bounded automatic gloss repair remain.
- Settings revocation stops affected work without invalidating already accepted
  text. Those helpers remain explicitly retryable. Revocation follows the actual
  retried operation's route, including speech whose text came from another route.
- Pre-dispatch checks compare actual endpoint/credential authority, not global
  revision numbers. Recording/transcription similarly tolerates unrelated setting
  revisions but still rejects revoked credentials or changed destinations.
- Cancellation, archived/deleted/edited sources, active-request coalescing,
  late-result rejection and retained usage remain covered by regressions.

## Other checks reviewed

Provider refusal holds are separate durable records scoped to endpoint/credential
(or hosted service). They do not expire automatically; explicit Recover access is
required and provider retry times are enforced. This behavior remains unchanged.
It is distinct from counting successful history against a lifetime retry cap, but
its recovery UX merits a separate focused pass.

The “later turn exists” refusal remains: retrying an old unanswered turn must not
insert a new reply behind later conversation history. Settings-save revision
conflicts remain to prevent stale forms overwriting newer settings. Automatic
word repair stays limited to one follow-up and its existing automatic-work budget.
No automatic provider retries were introduced.

## Verification

Final full native suite: **450 passed, 3 failed, 2 ignored**. All execution,
scheduler and recording regressions passed, including route changes, credential
revocation, cache loss, repeated retries past the former caps, sibling isolation,
cancellation and source edits. Local HTTP fixtures ran with loopback permission.

The three failures are existing Arabic font-scale expectations (`1.8`) versus the
unrelated working-tree content edit (`1.0`): `resolved_behavior_baseline`,
`browser_reports_effective_values_and_ordered_rule_sources`, and
`script_scale_defaults_to_standard_and_language_overrides_remain_effective`.

Clippy reports three unrelated warnings-as-errors in the existing uncommitted
reading command/tests (`needless_borrow` and `explicit_auto_deref`). These edits
were preserved. No UI behavior changed; no running-app verification, deployment,
commit, or data reset was performed. Native rebuild/restart is required to use
these changes.

Repository-wide rustfmt also reports pre-existing formatting differences outside
this change (provider module, local-server command, configuration, prompt,
snapshots and preference tests). Changed Rust files are formatted; `git diff
--check` passes.
