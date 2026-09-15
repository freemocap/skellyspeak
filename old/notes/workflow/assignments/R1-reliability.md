# R1 — Reliability and security

## Current assignment

The lifecycle/transport slice is integrated. The user expanded this domain to
security and hardening. Begin a bounded read-only audit of current root source,
including its uncommitted changes: route credential/destination isolation, local
server boundaries, grouped settlement/errors, concurrency/dedup, diagnostics and
deployment/secrets. Report concrete findings and prioritized fixes. Coordinate
file ownership with integration before implementation; do not duplicate the active
server error-handling repair. No Git writes, deployment or paid evaluation.

AI Operations owns provider/model evaluation proposals. Reliability retains
scheduling/accounting/security ownership and must preserve parallelism and partial
hydration. Existing implementation authorization is not revoked; shared edits still
require coordination.


Read ../README.md, ../../AGENTS.md, ../../EXECUTION.md, ../../architecture.md and
README.md at the repository root. Own only the R1 files listed in the ownership map
and directly associated tests. Report in workflow/reports/R1.md.

## Outcome

Make the current partner-reply/translation graph demonstrably bounded and correct
under interruption, authority changes and concurrent use. Preserve responsiveness.
Do not add tokenization, new model routing, UI features or transport redesign.

## Work

- Audit translation eligibility captured at Send, immutable source ownership,
  assisting state, queue reservations and total attempt budgets.
- Verify explicit retry after a later message exists cannot regenerate the reply;
  refusal during queued assistance cannot leak dispatch across authority changes.
- Cover restart before dispatch versus during an unknown paid outcome, source
  deletion/edit invalidation, pause/step/cancel, and concurrent next Send.
- Check direct-key and grouped hosted/custom dispatch preserve identical lifecycle
  semantics, per-item results and accounting. Use existing loopback fixtures for
  protocol tests. Do not create a fake production provider or access real keys.
- Fix demonstrated bugs within ownership; propose shared-schema/contract changes
  to integration. Preserve bounded parallel execution, not a global serial queue.

## Acceptance

Meaningful regression tests for found gaps, native suite and Clippy, with exact
results. No automatic network retries, no extra work from snapshots, and no late
publication after invalidation. Tests must distinguish successful siblings from
unknown results in a broken group. Record untested live routes honestly. Ask for
coordinated native QA only if it resolves a specific remaining question.

Do not edit L1/U1 files, shared docs or secrets. Do not commit, push or deploy.
