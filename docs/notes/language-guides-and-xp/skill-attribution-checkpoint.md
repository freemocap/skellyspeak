# Skill attribution checkpoint

Status: implemented locally and verified, 2026-09-25. No deployment.

## Agreed behavior

Skill presence and source attribution have separate responsibilities. Presence
determines experience and credit. A dependent extraction request locates the
original text supporting eligible skills. It cannot award, remove or multiply XP.
When supporting text cannot be located reliably, retain the full original message
as evidence, as requested.

## Implemented

- `skill_assessment` precedes the new automatic `skill_attribution` operation in
  the existing turn graph. The latter uses the configured fast route and shared
  structured transport, attempt lifecycle, diagnostics and retry controls.
- Eligibility requires a positive category and combined direct/contextual
  probability at or above `attribution.minimum_positive_probability` in
  `content/prompts/skills/presence.yaml`. The initial value is **0.60**, a tunable
  starting policy, not a calibrated accuracy claim. Save the threshold with the
  assessment; retain the original category probabilities, including rejected ones.
- Send one extraction request containing the original message and compact
  definitions for all eligible skills. No eligible skills means no extraction
  request. Baseline classification content remains unchanged.
- Output contains exact quotes and zero-based occurrence indices. Native code
  validates coverage, original-text matching and grapheme boundaries, then stores
  UTF-16 ranges for display. No normalization or corrected text is substituted.
- Empty spans or unmatched quotes select whole-message evidence for that skill.
  Persist the reason. Malformed responses and transport failures remain explicit
  operation errors; they do not roll back credit. Retry extraction independently.
- Learner records expose attribution state, attempt, reason and validated ranges.
  Existing phrase highlighting and evidence reports consume the ranges. Multiple
  spans share the same credited skill identity. The skill guide remains accessible.

## Verification

- Native suite: 612 passed, three opt-in tests skipped. Includes threshold gating,
  dependency ordering, fast routing, no-call empty selection, exact Unicode ranges,
  repeated occurrences, persisted evidence, whole-message evidence, malformed
  output, retry, stale completion rejection and unchanged credit.
- A separate opt-in test completed one real structured extraction through the
  local development service. Presence was supplied as a controlled fixture; this
  verifies the new extraction transport/publication path, not classification
  accuracy. Original-text spans validated and XP remained unchanged.
- UI evidence projection and feedback regression checks passed (58 tests).
  The broad UI run initially found two feedback expectations predating automatic
  rich feedback; those expectations were corrected and their suites rerun.
- TypeScript and generated contract checks passed. The YAML schema was generated
  through the existing exporter.

Run the opt-in check with the local service available:

```sh
cargo test --manifest-path native/Cargo.toml --lib local_attribution_round_trip -- --ignored --nocapture
```

This makes one paid extraction request using the local service's configured fast
route and a temporary workspace. It does not modify the learner's workspace.

## Remaining validation

The running desktop process must load a rebuilt native binary to execute the new
operation. Interactive desktop verification of this additional stage is separate
from the completed native integration and local-service test. Broader attribution
quality and threshold calibration remain future experiments, not release claims.
