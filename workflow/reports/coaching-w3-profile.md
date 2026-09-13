# Wave 3: open learner-model presentation

Implemented the first profile slice, accessible through Profile → Your learning
evidence. Native get_learner_profile returns the evidence snapshot and derived
state from one locked read. Frontend timestamps now have correct JSON number
contracts. The view has variety filtering, independent and assisted observation
counts, experimental estimate/uncertainty, last observation and due dates.
Insufficient evidence suppresses numeric estimates. Quotes remain inspectable
when excluded; exclusion/restoration uses the existing revision-checked command,
refreshes the shared evidence store and rereads derived state. Failed writes do
not claim success. Cross-language late responses are ignored.

Existing statistics remain separate; their method text now distinguishes saved
policy awards from legacy fixed XP. No provider calls or Git writes.

Verification: 577 frontend tests and 301 native tests pass, one live-provider test
ignored. Added profile tests cover quote inspection, exclusion/restore, revision
failure and late cross-language reads; a fifth focused test verifies variety filtering. Build, contracts and strict Clippy pass.
UX agent owns ongoing CSS consistency audit and new profile presentation.
Native app was not restarted. Actual production LearnerModel was visually checked in Safari with mocked read-only
IPC: desktop light/dark and 360px iframe, including source expansion, joined Arabic,
wrapped long identifiers and local table scrolling. This is browser fixture
verification, not native-device or live-provider verification.

Still planned: lens grouping, partner-filtered estimates, complete learner-choice
export, fluency, session goals/reviews, openers and remaining reward milestones.
This completes a bounded profile slice, not Wave 3.
