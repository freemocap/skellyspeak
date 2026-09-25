# Repeated coaching observations

Implemented locally, September 25, 2026.

The recorded coaching failures repeated a skill identifier across distinct
passages: one needed a correction and another demonstrated the skill. Rejecting
the entire response on repeated skill identifiers discarded useful feedback.

Coaching now validates each observation and collapses identical observations,
preserving distinct quotes, outcomes and corrections under the same skill.
Unknown skills and invalid source quotations remain errors. Raw response records
remain unchanged for diagnostics. These observations do not award skill XP.

Repair validation considers all observations for the target skill. A demonstrated
passage cannot establish repair while another returned passage for that skill
still reports an unresolved issue. Repair status no longer depends on which
observation appeared first.

Regression coverage exercises exact duplicates, distinct passages, mixed correct
and correction evidence, unknown skills, and invalid source quotations. No
provider request or deployment is needed for this validation change.
