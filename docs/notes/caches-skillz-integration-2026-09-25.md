# Caches and skills integration

Status: source integration and automated verification complete; desktop smoke test pending.

## Scope

The `caches-skillz` branch combines main at `69059438` (the landed cache work)
with `skillz` at `ea477bc0` (`woo`). The intended PR target is `skillz`.
The merge remains uncommitted for the repository owner to review and commit.
No deployment or live administrative action was performed.

## Resolution decisions

- Keep the skills catalog, guides, presence assessment, attribution, experience
  and effort accounting, recommendations, and message XP payout behavior.
  Conversation credit remains transactionally owned by the learning/publication
  code; result reuse does not create an alternative reward authority.
- Keep shared speech/transcription execution, independent receipt settlement,
  durable recording timing, local result retention, and the existing Drill
  spectrogram, alignment, playback cursor and attempt-selection behavior.
- Preserve language-selected speech models. Before shared execution, validate
  the captured access revision, destination, credential and requested global
  model against current access, while retaining the already selected model.
  Do not repeat availability discovery or replace the captured choice.
  Recording publication likewise compares the requested global model, so a
  compatible language-specific selection is not rejected. Publication continues
  to tolerate unrelated settings revisions after recording.
- Include `language_tag` in speech input construction, scheduled speech and the
  exact local cache key. The new cache identity does not reuse entries that lack
  this wire input. Preserve alignment payloads and redacted routing metadata.
- Keep the shared proposal executor for skill-focused Drill generation. Capture
  skill focus into its parser closure without restoring the old execution path.
- Keep the shared phrase action location and preserve Add/Remove from Drill.
  Remove the duplicate action left in the conversation analysis panel.
- Keep the header XP scoped to its conversation while retaining message payouts
  and the language-level profile. Retire the old automatic arrival cards.
- Combine server packaging entries for alignment and speech routing. Regenerate
  admin assets from source. Combine all seven locale dictionaries and remove
  79 confirmed unused keys from retired assessment/reward surfaces.
- Retain the skills branch's removal of the obsolete live-provider test, which
  asserted retired feedback fields. Its active replacement tests remain present.

## Verification

- Native: 653 passed, 3 opt-in live tests ignored.
- UI: 1,303 passed across 202 files.
- Server: 594 passed, 7 emulator-dependent tests skipped.
- Strict native lint for library and tests, formatting, generated contracts and
  benchmark fixtures passed.
- Production UI build, preview type checks, diagnostic policy, style checks,
  localization tests/audit and documentation links passed.
- Documentation: 28 tests and 7 dependency bounds/security tests passed after
  installing declared dependencies and applying the existing postinstall patch.
- Import graph: zero unresolved relative imports. Unreachable-code candidates
  are a report, not authorization to delete unrelated modules.

The tests use fixtures and local mock services. They do not verify current paid
provider behavior, desktop audio hardware, or the deployed service. Existing test
environment notices include missing canvas support, a server test-client
deprecation, and the production bundle size advisory.

## Desktop review before PR

The first desktop check exposed incompatible reward JSON from workspace format
40: the current model requires experience and effort fields. The format is now
41. Startup refuses incompatible workspaces before product reads and presents
the existing Factory Reset screen. Reset deletes the app's local data; reopen
the app to create the current workspace. No migration, historical reward reader
or score conversion is provided. Future incompatible persisted JSON changes
must bump the same workspace format even if SQL table definitions do not change.
Verification of this correction: startup incompatibility regression passed,
40 storage tests passed, and all 6 existing startup reset UI tests passed.

Restart the app and local server from this checkout. Speech routing adds a
`language_tag` request field and requires the routing inventory in `/v1/protocol`;
the combined app must be tested against the combined local server.

1. Send and revise a conversation message. Verify presence/attribution details,
   once-only XP payouts, and separate message/conversation/language totals.
2. Generate Drill phrases with a skill focus; accept a phrase and use Add/Remove
   from a reading surface.
3. Play reference speech, record a take, inspect timestamps, align words and
   verify both playback cursors. Switch phrases quickly and replay after restart.
4. Exercise a language whose compatible recognizer differs from the configured
   global default. Verify the recorded route and shared execution receipt.

Review local logs after this test. Hosted deployment and rollout remain a separate
explicit decision; this work does not authorize changing GCP.

## Local desktop follow-up

The post-reset run used workspace format 41. All 80 completed server requests
returned HTTP 200; 100 provider calls finished and settled. All 21 transcription
executions and 8 speech executions succeeded. Seven word-help consumers were
explicitly cancelled; their shared executions still succeeded. The one invalidated
coaching operation belonged to a replaced turn.

Two fixes follow that review:

- Reset cleanup removes only native run directories, not independently owned
  server/launcher logs under the shared development root. A regression holds a
  server log open with exclusive Windows access while app cleanup succeeds.
- Confirmed caller cancellation of reading help is retained as an informational
  diagnostic. Access changes and other failures still log as errors. Word Help
  inspection also keeps its current request alive when unrelated saved meanings
  refresh; changing the question or closing the inspector still cancels it.

Focused verification: 30 UI tests, 12 factory-reset tests, TypeScript and diagnostic
policy checks pass. These source fixes require restarting the desktop build for
live verification. Existing pending log cleanup is retried on that startup.


## Assessment and feedback follow-up

The numerical rejection policy described below is superseded by the accepted-choice policy at the end of this section.

Observed in local attempt history: one completed rating response selected a
choice with probability 0.18 while another choice had 0.19. The published
[choice response contract](https://docs.typesafe.ai/primitives/choice) requires
the selected choice to have maximum probability. Validation correctly rejected
that response; it must not manufacture a replacement score. Other failures
included three coaching responses truncated at 2,048 output tokens, upstream
rate limits, and a proposed correction identical to its source. HTTP 200 on the
grouped operation does not imply that every item succeeded.

Implemented: the score badge no longer substitutes correction prose when ratings
are missing. Skill evidence is below coaching corrections and collapsed by
default. Inconsistent rating errors now explain the problem and retain numeric
validation diagnostics. Coaching and repair checks have an 8,192-token output
allowance; other structured tasks retain their existing allowance. The coaching
prompt explicitly forbids repeating unchanged wording as a correction; semantic
validation still rejects it. No automatic retry or fabricated scores were added.

Verification: 23 focused UI tests, TypeScript, styles, localization and diagnostic
policy checks passed. Native suite passed 656 tests with 3 opt-in tests ignored;
the subsequently added coaching dispatch allowance test also passed. Desktop
restart and live feedback retry remain necessary to verify the changed behavior
against new service responses. Existing failed attempts remain historical
failures; retry creates new work. No server deployment or commit was performed.


### Accepted-choice policy (implemented)

The returned known choice is authoritative for message ratings, partner
understanding and skill presence. Probability totals and ranking are no longer
acceptance conditions: no tolerance, normalization or local winner calculation
is used. Preserve the probabilities unchanged. Structural checks remain for
required fields, declared choice labels, complete probability keys and finite
numbers within 0?1; these do not compare probabilities with each other.
Regression tests cover an accepted nonmaximum choice with a non-unit total,
unchanged retained probabilities, and rejection of unknown labels or values
outside the declared numeric range. No request or server change is required.


## Speech routing and final log audit

Implemented per requested best-effort speech policy: listed language matches
retain priority; models explicitly configured with `allow_unlisted_languages`
can accept a valid unlisted language tag after listed candidates are exhausted.
Transcription falls through the preferred recognizer to the configured alternative;
synthesis uses its separately configured model. The resolution retains the original
tag and `unlisted_language_attempt` reason. No language-specific branch, capability
claim, automatic retry or credential-route switching is introduced. Both native
selection and server admission use the shared generated catalog. Server restart
is required; no deployment was performed. Unfinished skills/language content is
outside this change. The user deferred live recording/playback verification.

Verification: 657 native tests passed (3 opt-in skipped); 601 server tests passed
(7 emulator-dependent skipped). Tests cover listed preferences, unavailable
models, unlisted transcription and synthesis, tag preservation, timing retention
and rejection of malformed tags. Generated schema and server catalog updated.

Current-run audit: two coach repair attempts were rejected for a correction
identical to its quoted source, each alongside other observation items. The
whole-response rejection was an open coaching issue at this audit, independent of
numeric assessment validation; the correction follow-up below resolves it. One stale coaching disclosure conflict and two local
speech capability rejections were recorded. Expected reading cancellations were
informational. The server recorded 174 provider/settlement completions and one
generic Python error without explanatory details. The transient Drill window
error could not be identified from retained diagnostics and remains unresolved.
Completion counts alone do not prove every provider result was valid.

No unresolved Git index conflicts. Integration changes remain uncommitted;
publication to the target branch requires the user's commit first. No merge
commit, push or deployment has been performed during this follow-up.


## Coaching correction follow-up

Implemented: removed correction-count quotas from authored policy, native
validation, response schema and prompt. Feedback projects all distinct explicit
corrections after disclosure, while preserving the primary correction for the
existing source-bound repair workflow. Each item remains bounded in size, and
the transport/output-size limits remain resource safeguards, not correction quotas.
Unchanged replacements no longer reject the response: original observations and
raw response remain retained, that replacement is omitted from display, and an
expandable note plus item-index diagnostics explain the omission. An unchanged
repair target cannot establish repair success. No-op handling does not award skill
credit. Language-independent exact source binding remains enforced.

Request audit: the current workspace had one repeated coaching input/model pair,
two failed repair checks at 21:12:53 and 21:13:03 UTC. No repeated successful
coaching input/model pair was found. At that audit, scheduled coaching bypassed
the shared exact text-result cache used by reading help: successful operation
retention was not cross-operation request caching. The integration below closes
this gap for correction feedback and repair checks, separately from
quote/replacement equality within one response.

Coaching verification: 658 native tests passed (3 opt-in skipped), plus the expanded no-op publication/repair regression passed. 85 focused UI tests, TypeScript, localization checks and strict native lint passed. Live desktop verification remains pending; no commit or deployment.


## Coaching cache completion and desktop handoff

Implemented: correction feedback and repair checks now use the existing shared
result store, bounded payload cache and pending subscription registry. Identity
covers exact transport payload/schema, model/access identity and captured
validation inputs. Consumer attempt/operation IDs are excluded. These tasks run
as individual shared executions; other scheduled text tasks keep their existing
grouped execution path. The scheduler transfers its existing admission permit to
the shared producer, rather than acquiring a second permit.

Validated successful responses are retained. Provider failures and invalid
responses are not reusable. Original invalid response text still reaches ordinary
attempt publication for inspection. The user explicitly approved new requests on
explicit retry when no usable result exists; no automatic retry was added.
Publication continues to validate each turn, source and retry provenance. An
individual cancellation cannot abandon other subscribers or receipt settlement.
Each provider execution contributes usage once; cached consumers retain the
original provider metadata and shared execution association.

Verification: 662 native tests passed, 3 opt-in skipped; 1,307 UI tests passed.
Four local HTTP/cache tests cover success reuse, one-time usage, original
metadata, invalid-response retention, the actual explicit Retry command,
concurrent consumers, cancellation and stale publication, and request identity
changes. The strengthened Retry-command test passed after the full suite.
TypeScript, strict native lint, generated contract checks and staged/unstaged
whitespace checks passed. No unresolved index conflicts. No server changes were
needed for this caching follow-up; prior server verification remains 601 passed,
7 emulator-dependent skipped. Browser tests report their existing unavailable
canvas implementation; visual playback still requires desktop inspection.

Desktop check: restart the native app, try text with multiple clear errors, open
feedback and confirm corrections appear above the collapsed skills section.
Exercise revised text and a failed-help retry if a failure occurs naturally;
review the resulting logs for cache/execution identity and retained diagnostics.
No artificial provider failure or paid test was introduced.

Cherokee follow-up: the 21:55 UTC opening used an unlisted-language synthesis
attempt and returned new audio successfully at the transport layer, but the user
reported unusable output. This is not verified language support. Quality work is
explicitly deferred. The earlier transient Drill window error was not reproduced
or diagnosed; watch for recurrence during desktop testing.

Changes remain uncommitted. After desktop acceptance, refresh the target branch,
resolve any newly introduced conflicts, and check the final diff. The user will
commit before a PR targeting `skillz`; no commit, push, PR or deployment was made
in this follow-up.


## Revised-message repair consistency follow-up

Observed: two failures at 22:36 UTC reported repaired=false while marking the
previous target demonstrated and identifying a separate possession correction.
The rejection compared fields within each response, not previously awarded XP.
This agreement requirement was unnecessary and discarded usable current feedback.

Implemented: removed the repair-flag/evidence agreement rejection. A prior target
may be absent or have a different outcome without rejecting the revision. Repair
notes are optional when no demonstrated prior-target item exists; native code does
not manufacture evidence to satisfy the boolean. Current actionable corrections
are selected regardless of repair success and are no longer limited to the prior
target. Skill assessment and reward ownership are unchanged and remain independent
of correction feedback. Existing unchanged-replacement display handling remains.

The retry-specific prompt contained an overlooked zero-or-one-suggestion sentence.
It now assesses the revised source in full, permits changed meaning/skill coverage,
and applies no correction-count quota. Feedback prompt version is 11; exact cache
identity includes the changed prompt. No provider call, data reset or deployment
was needed for this fix.

Verification: 663 native tests passed, 3 opt-in skipped; strict native lint passed.
Regression cases cover both repair flags with the old skill demonstrated, partial,
or absent, preserving and displaying the new correction in every case. Restart the
native app and explicitly retry existing failed help to exercise the updated path.
Changes remain uncommitted.


## PR 45 CI checksum fix

The two server test jobs and Windows contract check failed on the same speech
catalog source checksum. Local CRLF bytes produced a different hash from the LF
source stored in Git; authored content and generated routing values matched.
The exporter now canonicalizes CRLF to LF before hashing. The server source check
uses the same canonical text policy, and the generated catalog was regenerated.
Exporter regression coverage checks LF/CRLF equivalence and sensitivity to actual
content changes; CI now runs that exporter test. Server coverage exercises both
line endings against the generated checksum.

Verification: 602 server tests passed, 7 emulator tests skipped; exporter regression,
generated contracts check, exporter strict lint, formatting and diff checks passed.
Android, iOS, Linux, frontend, docs and container CI jobs passed on the existing PR
commit. Only the three checksum-related jobs failed. Fixes remain uncommitted and
must be committed and pushed by the user before remote CI can verify them.
