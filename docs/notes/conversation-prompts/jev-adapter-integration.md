# Selectable skill-assessment adapters

## Current status — Jev shelved, 2026-09-21

The [expanded quote experiment](jev-span-comparison-2026-09-21/README.md) tested
four prompts on Fast and Standard (872 new calls). None matched the previous
Chat system's delivered evidence. Per the user's conditional instruction, Chat
model assessment is restored as the fresh-workspace default; startup also replaces
a saved Jev preference. App settings disable Jev, and the native settings command
rejects selecting it. Internal adapters, experiment harnesses and receipts remain.

Startup recovery suspends unfinished, unpublished Jev assessments. An explicit
retry reuses the existing current-settings retry path to run Chat assessment;
completed evidence and past provider receipts are preserved. No new automatic
retry or silent provider fallback is introduced. Existing quote-linked XP UI,
sounds, animation and dismissal behavior remain. Changes require the rebuilt
native application to start; no running application restart or deployment is claimed.

Verification: 503 native tests and 64 focused reward/message/settings tests passed
plus the additional failed-extraction recovery test. UI/experiment build
verification is recorded in the expanded experiment README.

## Historical implementation record (superseded where above differs)

Status: implemented in source, 2026-09-21. Not deployed. This supersedes the
initial proposal and its pending evidence question; the user authorized the
integration, Jev default, explicit method names and explanatory information popup.

## Implemented behavior

Models contains **Skill assessment**, with **Jev Choice** as the fresh-workspace
default and **Chat model assessment** as the selectable existing implementation.
The actual model ID is displayed separately. The information marker opens on
hover or keyboard focus, pins on click/tap, and closes on a second click, Escape
or outside interaction. Text is localized in all seven interface languages.

Jev uses `typesafe/jev-1.13` through OpenRouter's Decisions endpoint. It receives
45 five-category questions using the experimentally tested Original Choice
formulation, parameterized by target language. The frozen policy requires 0.50
combined demonstrated/partial probability for partial evidence and 0.80
demonstrated probability for full evidence. These probabilities describe model
assessment outcomes, not learner proficiency or empirically calibrated certainty.

The chat adapter retains the selected Fast model, its existing prompt, maximum
four observations, exact quote validation and explanations. Jev records all 45
answers and probabilities as whole-message evidence. It does not fabricate
supporting excerpts, explanations or inline quote highlights. Rewards use the
original whole message as their source for Jev, retain one-time credit and
assistance weighting, and do not credit absent/uncertain outcomes. Unlike chat,
Jev is not limited to four positive skills, so reward volume can differ.

Adapter-only settings changes affect future work, preserve captured in-flight
operations, and persist across restart. Explicit retries capture the selected
adapter. Historical records retain the actual assessment method, model, policy
and provider; inspection shows the decisions request rather than a fictitious
chat request. Invalid or unavailable decisions fail visibly without model fallback.

## Architecture

- `native/src/learning/coaching/assessment_adapter.rs` owns request construction,
  probability validation, outcome policy and evidence semantics.
- Execution captures the adapter with the turn, constructs the appropriate
  request, and publishes through the existing transaction and reward path.
- `native/src/ai/transport/provider/decisions.rs` uses the bounded shared HTTP
  transport at `/api/alpha/decisions`; chat generation parameters are omitted.
- Hosted/custom grouped work carries the explicit decisions payload. Server
  validation bounds state/questions; actual usage and cost remain provider-derived.
  Grouping separates decisions from streaming chat. No automatic Jev retry.
- Evidence history exposes whole-message provenance and expandable scores/policy;
  activity inspection retains the request and response. Diagnostics redact content
  while retaining model, request identity, usage, billing and validation metadata.

## Verification

- Focused UI suites: 23 passed, covering Models selection/save, information popup
  interaction, whole-message reward projection and absence of fabricated highlights.
- Native assessment suites: 6 passed, 2 intentionally ignored export tests. Covers
  fresh default, persistence, captured work, whole-message credit, recorded request,
  frozen thresholds and malformed/missing/extra answers.
- Provider transport suite: 3 passed. Tests cover dated actual model IDs, native usage field names,
  retained billing metadata and invalid answers; local HTTP fixture checks exact body.
- Server decisions/grouped/accounting-related suites: 74 passed.
- Earlier full native run: 483 passed, 4 ignored, one workspace-reset lock failure;
  that reset test passed when rerun alone. Do not describe the full run as all green.
- Models component inspected in a running browser at desktop and 390px phone width.
  Preview uses session-only mock settings and makes no AI calls.
- Production UI build, preview TypeScript check, localization validation, style checks
  and diff whitespace checks passed. Vite reports its existing large-bundle advisory.
- No paid provider calls, application-data reset, commit or deployment performed.

## Runtime limits and rollout

Native schema is now version 27. Existing development workspaces require the
explicit reset flow; there is no migration or silent deletion. Running binaries
must be rebuilt. Hosted/custom routes require this updated server to be deployed;
older servers reject decisions rather than falling back to another model.

The experiment evidence is Spanish-focused. The implementation parameterizes
language, but this does not establish equivalent accuracy in every language.
Thresholds are versioned policy, not universal performance guarantees.

## Protocol reference

OpenRouter Decisions documentation, checked 2026-09-21:
https://openrouter.ai/docs/api/api-reference/alphadecisions/submit-a-decisions-questions-and-answers-request

The frozen experiments under this directory retain exact request/response receipts
and remain the empirical source for the chosen formulation.

## Speech-input admission fix — 2026-09-21

Observed in the running desktop workspace: five failed Jev assessments, all
rejected by the custom local server with HTTP 400 `Invalid decisions input flags`.
The native application correctly captures `speech_transcript`; the new server
validator mistakenly accepted `speech` instead. Thus these requests never reached
Jev and could not publish assessment evidence or XP.

Corrected the validator to match the native `text | speech_transcript` contract.
Added grouped-admission coverage for both valid modalities and rejection coverage
for unsupported values. Decisions and grouped suites: 30 passed. All five actual
recorded failed requests pass corrected offline validation. The idle local server
was restarted with the same saved session credentials. No provider requests were
replayed and no XP was fabricated; historical failures require explicit retry.
Successful live speech assessment and resulting XP remain to be observed.

## Contract audit — 2026-09-21

Scope: Jev native capture/dispatch, direct and grouped request shapes, server
admission, response decoding, model identity, metadata, explicit retry selection,
evidence projection and XP publication. This is a targeted integration audit,
not a claim that every unrelated concurrent change has been audited.

### Findings and corrections

1. **Confirmed runtime failure:** server admitted `speech` instead of the native
   `speech_transcript` value. Corrected in the preceding fix. Replaced the Python
   hand-authored request fixture with speech and text fixtures generated by actual
   native turn admission/dispatch. Both native and server suites enforce them.
2. **Size-boundary mismatch:** Python measured JSON with spaces while Rust used
   compact UTF-8 JSON. Server now measures the same compact representation. Added
   a multibyte exact-limit/one-byte-over test. This was a latent boundary defect,
   not the cause of the user's observed failures.
3. **Brittle model identity:** native validation allowed only the base model or one
   literal dated revision, unlike the experiment harness. It now permits the
   requested `typesafe/jev-1.13` family with an eight-digit revision suffix, while
   rejecting other families and arbitrary suffixes. Requested model remains pinned.
4. **Error observability gap:** malformed hosted Jev answers became a generic
   exception without provider identity/billing metadata. They now return a bounded,
   redacted validation error retaining request ID, actual model, usage/cost and
   validation path. A grouped HTTP regression test checks both retention and redaction.

### Verification evidence

- Complete native library suite: **495 passed, 5 intentionally ignored**, serial
  execution (no workspace-lock flake). The optional live-receipt replay was run
  separately and passed.
- Server inference, accounting and admission suites: **311 passed**.
- Shared native-generated wire fixtures cover both text and speech. Server matrix
  covers 16 modality/assistance combinations and four-message multilingual context.
- Native publication matrix covers text/speech × demonstrated/partial/absent/
  uncertain/invalid results. Positive evidence produces XP; absent/uncertain/invalid
  evidence does not. Duplicate callbacks do not multiply XP.
- Failed-assessment retries tested Jev → chat and chat → Jev. Saved method reflects
  the successful retry; successful sibling operations are not rerun.
- **One live synthetic request** through the authenticated local grouped API to Jev:
  45 answers, actual model `typesafe/jev-1.13-20260917`, 10,789 input tokens,
  2,946 output tokens, provider-reported cost **$0.000453138**, measured API elapsed
  **0.339 seconds**. These are one smoke-test receipt, not a performance estimate.
- Replayed that exact response through native decoding, validation and publication
  in a temporary workspace: **60 XP**, unchanged after a duplicate publication.
  The request was the same synthetic speech fixture admitted by native. No user
  conversation was resubmitted or credited by this audit.

Protocol rechecked against OpenRouter's Decisions documentation linked above:
Choice responses include type, choice, confidence and category probabilities.
The API contract check does not establish model accuracy across languages.
Native source changes require the running application's next rebuild; audit server
changes are applied to the local development server, not a hosted deployment.

Follow-up runtime observation during this audit: the latest three actual app
assessments (13:13:25, 13:13:50 and 13:18:46 UTC) succeeded with Jev; the workspace
contained 94 XP in retained reward events. This is read-only observation of real
app execution, separate from the temporary-workspace smoke test. The local server
was left running with all server audit corrections loaded after checking it was
idle. Focused Models/evidence/rewards UI suites: 21 passed. Native fixture check
was rerun after extending it to generate both modalities; Python admission suite
then passed all 32 tests. Whitespace checks passed. No commits or deployment.

## Reward presentation correction — 2026-09-21

The preceding audit established native credit publication but missed the live UI
presentation boundary. `SkillRewards` claimed Jev events, then projected them
through `messageEvidence`, which intentionally omits whole-message classifications
to avoid inventing highlighted phrases. Consequently the presentation received
an empty list and no animation or sound ran. The earlier XP tests were insufficient
to establish visible reward behavior.

Added a separate `messageRewardEvidence` projection, used by arrivals, floating
cards, mobile progress receipts and saved XP inspection. Phrase highlighting still
uses the quote-only projection. Chat now renders whole-message XP badges with
explicit Jev provenance in their detail cards. Presentation evidence is resolved
before durable display claims are consumed. Existing claimed history remains
inspectable but is not automatically replayed or credited again.

Also corrected fast mobile arrivals with reduced motion: they skip the hovering
phase, so sound now runs on immediate arrival instead of being skipped with the
animation. Sound preferences remain enforced by the existing audio layer.

Verification: 77 tests across 12 reward/message/evidence/audio suites passed,
including actual Jev whole-message arrival through durable claim, animated mobile
receipt, sound invocation, reduced-motion sound, clicked details and the production
TurnView badge. Production build, preview TypeScript and styles checks passed.
Browser inspection confirmed chat badges and floating cards at desktop width and
mobile XP progress at 390px. Audio invocation is automated-test verified; audible
output on the user's hardware was not independently verified. The synthetic
preview at `/tools/jev-rewards-preview.html` uses production components and makes
no provider calls or saved-workspace changes. No native or server change is needed
for this correction; the running application must load the updated frontend.

### Reward presentation refinement — 2026-09-21

Implemented: whole-message credit uses a dotted underline over the complete source
message while its badges remain visible; no phrase-level Jev attribution is invented.
Floating cards are 230px wide (previously 300px), with smaller XP labels and no
static assessment/credit explanations. Actual assessment rationale remains when supplied.
Badge dismissal persists in local browser/webview storage by durable evidence ID
and credit generation; it does not change native credit or celebration claims.
The message badge row and underline disappear when its last badge is dismissed.
Hidden desktop skill destinations now use the same temporary, arrival-filled meter
as mobile, replacing the star-only destination.

Verification: 57 tests across nine progress/message suites passed, including remount
persistence, newly increased credit, row removal, and desktop hidden-destination
fill timing. UI build, preview type check and style check passed. Browser preview
verified the underline, compact card without boilerplate, no badges after restoring
identical credits following reload, and a visible desktop temporary meter. This is
component/browser verification, not a new live native conversation run.

### Two-stage candidate and empirical stop — 2026-09-21

Source implementation adds declared `skill_evidence` after `skill_assessment`,
using the existing scheduler, captured Fast role, provider route/schema, receipt
and retry machinery. Chat assessment and empty Jev results need no extraction
provider call. Native exact-source validation preserves Jev scores/provenance;
localized results feed the existing quote underlines and inline XP badges through
plain, token and saved-gloss renderers. The whole-message dotted underline and
separate message badge row were removed. Tooltip translations describe the new path.

**This implementation is an unaccepted candidate, not a finished adoption.**
The user-requested paired experiment found 75/109 extractor responses fail the new
validator; combined with four prior Jev failures only 41/120 full pipelines survive,
versus 113/120 for Chat assessment. The candidate's all-or-nothing publication rule
blocks all XP when any one skill lacks a valid quote. This is a product regression
introduced by the candidate; it must be revised before calling the implementation
ready. No deployment or native app restart was performed by this task.

See [the report and next policy decision](jev-two-stage-2026-09-21/README.md).
The prior whole-message-badge presentation note is superseded by this source change.
The experimental source remains uncommitted; existing saved user data is untouched.

Final checks: 501 native tests passed (six ignored), 64 focused UI tests passed,
five experiment tests passed, and UI build, experiment TypeScript, preview type
and style checks passed. These checks validate machinery, not the failed adoption gate.
