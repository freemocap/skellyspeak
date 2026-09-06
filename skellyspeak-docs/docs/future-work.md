---
sidebar_position: 7
title: Future Work
---

# Future work

This page contains unimplemented design work. Current behavior belongs in
[Status](./status) and [Architecture](./architecture).

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
layer.

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
