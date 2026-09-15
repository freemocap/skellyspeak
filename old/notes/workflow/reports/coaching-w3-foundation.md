# Wave 3: learner-state foundation

User accepted Wave 2 for continuation on 2026-09-13 and placed UI polish in
separate work. This slice changes structural/native code, configuration, generated
contracts and documentation. It does not implement all of Wave 3.

Implemented:

- Required editable estimator policy, schema export, validation and policy hash.
- Deterministic per-learner/language/variety/construct projection over retained
  evidence. Direct and assisted counts remain distinct. Unknown/unobserved items,
  exclusions, incompatible registries and future records make no rating update.
- Exact-source checks, stable ordering, duplicate-wording suppression and explicit
  failure for unknown support values. Negative opportunities lower the rating.
- Rating, heuristic uncertainty, half-life, due time and insufficient-evidence
  state, with contributing attempt identities. XP calculations are unchanged.
- Native get_learner_state and export_learner_state commands. Export includes the
  existing sanitized evidence projections, focus/exclusion choices and config
  provenance. It is not an export of hidden correction targets, raw model output
  or every conversation's settings. Those broader export requirements remain open.

Estimator defaults are uncalibrated product parameters. Logistic update follows
Pelánek §2.1; recall curve follows Settles/Meeder §3.3. We do not implement trained
HLR or claim calibrated recall, uncertainty, CEFR or lens-level bands. Rating does
not decay; elapsed time changes review-due status only. Identical wording counts
once per variety/construct, even if its later use has a different assistance level.
Revisit that conservative independence rule during labelled evaluation.

Verification: 297 native tests passed, one live-provider test ignored. Focused
cases cover assistance, exclusion, absence, invalid provenance, deterministic
replay, future evidence, variety separation, due-without-rating-loss, YAML round
trip, native publication and restart. Strict Clippy, generated contracts,
production frontend build, frontend tests and documentation tests checked.

Runtime: installed the new required estimator.yaml into the local development
configuration without overwriting existing settings. Did not restart the user's
running app for this structural slice. No provider calls or data reset.

Still planned: reward policy and events, support/difficulty/novelty XP, lens-level
assessment, full learner-choice export, fluency pipeline, profile presentation,
openers and session review. The earlier partner_reaction.rs remains untracked
and must be included by the user in their Git checkpoint.
