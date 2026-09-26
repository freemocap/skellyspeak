---
sidebar_position: 7
title: Future Work
---

# Future work

This page contains unimplemented design work. Current behavior belongs in
[Status](./status) and [Architecture](./architecture).

## Learner, contacts, and language architecture

The [architecture redesign plan](./architecture-redesign) consolidates the proposed
learner–language profiles, durable contacts, relationship flowers, proficiency
reports, shared frontend state, language services, caching and model/resource
evaluation. It also includes static procedural avatars, editable persona Vibe,
source-attributed emoji observations, expanded reactions and descriptive statistics.
It records agreed direction, open decisions and complete migration
gates. Implementation starts after the current work is finished and the resulting
baseline is reviewed. These are proposals, not shipped capabilities.

## Meaning-domain progression

The [meaning-domain design](./skill-progression-design) defines the implemented
catalog, local profile, evidence-derived XP/checks/stars and saved practice focus.
The two product surfaces are Guided conversation and Skill tree; Stories is retired.

Next, calibrate the actual rubrics against reviewed multilingual examples,
including grammatical partials, uncertainty, assistance, revisions and false
positives. These samples validate a shared catalog, not separate curricula.
Profile switching, delayed review, richer audio evidence and alternative analysis
views remain future work. Avoid fixed branching factors or node-count targets.

## Local mechanical analysis

The [shared language service plan](./architecture-redesign#shared-language-service-and-ai-policy)
replaces the earlier standalone migration sequence. First unify passage contracts,
validation, result reuse and contextual caching; then compare smaller models and
language-specific dictionaries/morphology against reviewed multilingual fixtures.
Batch unresolved spans with context and retain provenance and attribution.

Set local-resolution and latency targets from a measured baseline rather than
promising an unvalidated token coverage percentage. Reference resources support
the existing languages; they do not define separate progression curricula.

## Prompt provenance and workbench

The [September instruction-flow audit](./ai-instruction-audit-2026-09-06)
records historical evidence of the zero-level failure. Captured context, shared
practice policy, per-attempt requests, durable traces, scoped exports and the
request comparison reader are now described in [Observability](./observability).
Remaining work includes:

- Fine-grained prompt-block provenance for every model operation.
- Preparation, skipped-work, cancellation and speech/transcription coverage.
- Active-operation snapshots when an inspector opens mid-call.
- Application acknowledgements beyond reply readiness and conversation saving.
- Semantic difficulty evaluation beyond mechanical length checks.
- Prompt editing and overrides; no prompt-override setting currently exists.

## Security follow-up

- Protect main and release tags; enable hosted repository secret scanning and push protection. Verify deployed cloud IAM and retention.
- Verify stable macOS development signing and Android backup/restore on physical devices.
- Resolve the upstream GTK/glib vulnerability, Rust maintenance advisories, and the docs image-size advisory when compatible fixes exist.
- Configure and verify dedicated provider spending limits and cloud edge abuse controls; billing alerts are not hard caps.
- Independently verify desktop native signer identity and notarization before publication.

## Product work

- Dedicated first-run onboarding.
- Vocabulary collection, review, and spaced repetition.
- Packaged-app end-to-end tests against the real Tauri IPC boundary.
- Physical-device acceptance coverage for microphone, credential vault,
  sign-in, playback, installation, and updates.

## Proposed UX follow-up

The [September 2026 UX audit](./ux-audit-2026-09-06) proposes these candidates for prioritization; they are not shipped behavior:

- Explicit microphone starting/transcribing/error states and duplicate-start prevention.
- Revision-safe restore of explicit lesson choices.
- Keyboard resizing parity for AI dock and graph splitters, with verified focus return.
- Contextual discovery of configured shortcuts.
- User-facing conversation and lesson export with explicit data scope.

Response-to-context provenance belongs to the prompt-provenance workbench above.

## Frontend coherence migration

The first integrated migration is implemented: shared target-scoped selection,
contextual map entry, XP summary, skill overview/evidence components, neutral selection,
shared domain palette, three suggested areas with All areas, demand-loaded shared
explanations, independent message reveal keys, and one mobile chat/lesson scroll.
Retired map styles, duplicate detail hosts and the obsolete Suggestions toggle/frontend
regeneration path were removed. This is not completion of the full source audit.

Remaining work:

- Verify native desktop and phone layouts, keyboard-open viewport, RTL, large text,
  touch targets and overlay/back navigation. Native inspection was unavailable during
  initial implementation; unit tests do not establish these results.
- Replace global reward-anchor scans with scoped, clipping-aware anchors and test
  scroll, route changes, simultaneous credits and reduced motion in the real app.
- Finish unifying Skills inspector controls and feedback/gloss overlay hosts, preserving
  history, exclusions, profile controls and explicit word assistance.
- Index evidence selectors and profile long histories. Snapshot event bursts now coalesce
  with a trailing refresh, and shared cache retries propagate across mounted views;
  measure these behaviors under native long-session load.
- Add conversation-grounded hints only with explicitly captured context. Current topic
  notes are generic skill/difficulty explanations.
- Clarify persona voice overrides and validate audio cache ownership on language changes.
- Complete the remaining CSS/control/accessibility census against the implementation audit.

Preserve the Rust execution pipeline, saved conversation state and progress rules.
