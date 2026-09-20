# Relationship + Examples: next-generation discussion

Analysis and proposal, not newly applied prompt wording. Existing 1440-response
corpus unchanged. Matched slice: original wording, temperature 1.1, provider-default
top_p, no persona, ten responses per difficulty. These results do not establish
a universal winner across all sampling conditions.

| Prompt | Mean words AZ / Beginner / Intermediate | Within target AZ / B / I | P(B longer than AZ) | Mean within-level cosine |
|---|---|---|---:|---:|
| Direct |6.1 /8.8 /22.0|40% /90% /70%|90%|0.433|
| Relationship |5.0 /11.9 /22.9|70% /50% /50%|98%|0.403|
| Contract |5.1 /6.6 /19.3|50% /80% /80%|83%|0.433|
| Examples |4.5 /5.9 /18.5|90% /80% /100%|87.5%|0.512|

Length separation and compliance are different. Relationship distinguishes levels
but overshoots Beginner and Intermediate limits. Examples fits the requested
ranges better but compresses the two lowest levels. Intermediate exceeds Beginner
in 100% of pair comparisons for Direct, Contract and Examples, and 98% for
Relationship. Pair comparisons count ties as half and are not independent trials.

Relationship also increases words per sentence 3.0 →5.72 →10.97 and letters per
word 3.56 →3.99 →4.14. Examples changes words per sentence 2.25 →2.95 →7.70,
but letters per word stays nearly flat 4.25 →4.14 →4.29. These are descriptive
surface measures; neither demonstrates CEFR validity.

A wider projected cloud is not necessarily more within-level variety. Beginner
cosine is 0.364 for Relationship versus 0.630 for Examples. Relationship can still
have local thematic clusters: its Absolute Zero responses repeatedly mention cats.
It has no exact repeats in this slice, which does not mean it escapes conceptual
repetition. Examples repeats “Hoy hace sol. ¿Vamos al parque?” four times among
ten Beginner outputs. Its location across several projected regions can coexist
with this local concentration.

## Mechanisms and defects

Relationship describes what the learner can understand and how the partner should
relate to them. That offers a plausible explanation for greater differentiation;
it is a hypothesis, not an isolated causal finding. It also changes instruction
length and language, so the experiment does not isolate a single ingredient.

Examples demonstrates a concrete move: a detail creates a decision, then the
learner's answer changes what happens next. That is worth retaining. But the
current examples are not consistently leveled: “Mi gato duerme. ¿Jugamos?” is
identical at Absolute Zero and Beginner, and its four words fall below the
Beginner 6–11 target. Its question also has a weak connection to the sleeping cat.
Several demonstrated continuation lines are shared across levels. Copying this
set into Relationship would import the compression problem.

Relationship itself produces “Ha caído una hoja.” with no invitation, and
“Un gato. ¿Sí?” with no meaningful answerable question. It also uses compound past
tense at Absolute Zero despite present-tense guidance. More separation alone
would not fix these failures.

Direct gives concise explicit rules but here misses Absolute Zero length limits
most often. Contract adds an internal checklist but does not reliably produce
better level separation or grounded questions. Both remain useful controls;
neither provides a clear reason to replace the Relationship/Examples combination.

## Proposed next round — discuss before writing/running

Keep unchanged Relationship and Examples as controls. Add two hybrids:

1. Relationship-led: retain its learner-capability descriptions and conversational
   stance; add a small set of carefully leveled, answerable opening demonstrations.
2. Example-led: retain behavior demonstrations; replace the abstract level label
   with a concise learner-capability description and an explicit distinction
   between Absolute Zero and Beginner.

Use equally varied everyday situations and conversational moves in both hybrids.
Examples should demonstrate different grammatical constructions and reasons to
reply, without forbidding words or manufacturing novelty. Every example should
meet its own length/grammar constraints and work in a text conversation without
shared physical presence. Avoid reusing the same tiny example at adjacent levels.

Hold sampling fixed for the first comparison (temperature 1.1, explicit top_p 0.8
for reproducibility), rerunning both controls under exactly those settings.
Keep persona/no-persona and ten repetitions per cell. No new calls made here.
Judge level fit, within-level semantic/opening repetition, and human-rated
answerability together. Retain the existing word targets for this comparison;
any relaxation should be a separately agreed factor.

## Explorer changes

Implemented up to four pinned highlight layers plus current selection. Fields
combine with AND inside each group; different groups retain separate colored
outlines, including when they overlap. Base visuals remain unchanged. The response
panel divider supports dragging, Left/Right arrows, Home/End and double-click
reset. On narrow mobile layouts the panels stack and the divider is hidden.
Redundant all-category buttons were removed from the inspector; active criteria
remain removable chips. No generation or embedding calls were needed.
