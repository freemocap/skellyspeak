# Wave 3 reward foundation

Implemented required game.yaml with bounded multipliers, event tiers, explicit
forbidden causes and all three reward rules. Turn acceptance captures policy and
hash; coach publication persists source-bound RewardEvents atomically. Practice
scoring v2 reads these saved awards. Initial unassisted demonstrated use earns
30 XP (10 × 1.5 × 2); routine use earns 15. Partial use and checked repairs have
their own bases. Novelty uses Monday-based UTC weeks; identical normalized whole
wording cannot be rewarded twice for the same learner/language/construct.

claim_reward_events is an atomic at-most-once presentation claim. The existing
reward UI claims new v2 events before presenting them. Unknown/already claimed
IDs return no presentation; source ownership is constrained by language and the
workspace. The award remains after claim; a crash may skip a celebration, never
remove XP or replay the celebration. Current effects remain the existing UI.

Verified: 300 native tests pass with one live-provider test ignored; 565 frontend
tests pass. Native tests cover duplicate publication/wording, policy immutability,
claim scope/replay/restart, assistance, difficulty and weekly novelty. Frontend
test verifies an already-consumed claim produces no presentation. Build, contract
export, strict Clippy and diff checks pass. Existing fixed-XP assertions were
updated to calculated policy results, with provenance assertions retained.

Installed required local development game.yaml without replacing existing config.
No data reset, new provider call, deployment, Git write or native app restart.
Earlier exchanges without captured policy receive no retroactive reward; source
evidence is retained. Exclusions/deletion still remove active contributions.

Remaining Wave 3: fluency, full profile/learner choices, openers/session reviews,
secured/goal/star/milestone events and richer tiered effects. Prior foundation
files and new reward files are untracked and need inclusion in the user checkpoint.
