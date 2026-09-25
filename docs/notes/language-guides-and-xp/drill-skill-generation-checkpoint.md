# Skill-targeted drill generation

Status: implemented locally, 2026-09-25. No deployment or commit.

Drill → Add phrases now offers an optional **Skill focus**: a specific skill,
Explore, Continue practicing, or Coach's choice. Length, difficulty and topic
remain independent controls. Generation still requires an explicit Generate
action; candidates still require Keep/Keep all.

Native admission resolves the skill against the requested language and variety.
Coach modes reuse the experience/effort selector and its variety-scoped counts.
The selected definition, language guidance and selection provenance are captured
before inference and persist with accepted generated phrases. An invalid skill
or unavailable effort-based selection fails before reserving work.

The existing generation request receives the captured target. No separate skill
assessment call was added. A generated phrase's target is displayed as **Skill
focus**, not a verified skill assessment. Generating or keeping a phrase does
not change experience, effort or XP. Chat-derived phrases retain their original
source and are not relabeled as generated skill practice.

The prompt requests fewer or no candidates when the skill cannot fit the chosen
shape naturally, rather than overriding length or inventing filler. Output quality
still needs human review; no claim of automatic semantic skill verification.

Verification: 10 native generation tests and 14 Add phrases UI tests passed;
TypeScript, generated contracts and styles passed. Tests cover the actual
structured-request payload through a local HTTP fixture, target persistence after
acceptance, unchanged XP, coach selection, pre-reservation failures, explicit
generation, and existing cancellation/acceptance behavior. No live paid generation
or matching-build desktop trial was performed for this addition.

Next interactive check: select a concrete skill and sentence length, generate a
small batch, inspect the target label and phrases, keep one, then try Explore.
