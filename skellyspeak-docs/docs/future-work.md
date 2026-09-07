---
sidebar_position: 7
title: Future Work
---

# Future work

This page contains unimplemented design work. Current behavior belongs in
[Status](./status) and [Architecture](./architecture).

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

The current guided pipeline uses model calls for tokenization, glosses, POS
tags, translation, and grammar cards. The target design moves deterministic
reference work onto the device:

```text
reply
  -> language-aware tokenization
  -> lemmatization/morphology
  -> dictionary and phrase lookup
  -> frequency metadata
  -> batched model call only for unresolved residue
```

Conversation generation, pedagogical judgment, grammar explanations, coaching,
and teaching-plan updates remain model work.

Candidate data sources include wiktextract/Wiktionary, FreeDict, Open
Multilingual WordNet, Apertium, and language-specific dictionaries. Licensing,
attribution, update size, and offline packaging must be decided before choosing
a source.

### Migration order

1. Define a language-neutral token/lemma/gloss contract and measure current
   model output as the comparison baseline.
2. Implement Spanish wordform lookup and longest-match phrase lookup.
3. Batch unresolved forms into one residue request.
4. Add offline quality tests and attribution UI.
5. Add Arabic morphology/RTL cases and Mandarin segmentation/tone cases.
6. Extend the same contract to English and French.

English, French, Spanish, Arabic, and Mandarin are already available for the
model-backed product. This order applies only to the planned local dictionary
layer. These lexical resources are independent of the shared capability graph;
they do not define language-specific progression rules.

### Success criteria

- At least 90% of ordinary tokens resolve without a network request.
- Identical word/context inputs produce stable glosses across conversations.
- Unresolved forms are batched rather than requested individually.
- The analysis pane hydrates immediately from local data.
- Dictionary attribution and licensing obligations are visible and testable.

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
