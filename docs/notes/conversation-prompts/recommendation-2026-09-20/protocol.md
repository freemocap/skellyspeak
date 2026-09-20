# Broader prompt evaluation protocol

Written before running these batches. Status: evaluation design, not product behavior.

Compare the complete approved conversation-23 reference against deterministic compact
persona projection with concise turn/difficulty guidance, with and without two
localized behavioral examples. Keep model/provider/temperature fixed. This is a
package comparison; it does not isolate every changed phrase. Prior factor screening
supplies the narrower comparisons.

135 fixed-context calls: Spanish/Spain, Arabic/Levantine, Mandarin/Mainland China ×
five product difficulties × three variants × opening/confusion/topic switch.
Novice/intermediate openings have no selected topic. Advanced openings request
future-oriented discussion of a city with fewer cars; Fluent uses past references.
Advanced/Fluent topic changes include a substantive opinion about music algorithms.
Confusion uses a closed shop, distinct from the coffee example in the candidate.
This varies settings by level and is not a pure measurement of level differences.

48 linked calls: three languages × Beginner/Intermediate × approved-23/compact-examples
× four partner turns. Scripted learner interventions are confusion, changing to music,
and preferring music at home. Every call includes that variant's actual generated
earlier partner responses. This measures response to diagnostic interventions, not
natural learner behavior, retention or learning outcomes. No user data is sent.

Evaluation questions:

- Does an opening give a specific, accessible response opportunity instead of only
  introducing the partner, making a generic check-in or offering tutoring?
- Does confusion produce a simpler expression of the same meaning, rather than a
  new question, an imagined explanation or a topic change?
- Does a topic change actually drop the preceding subject? For advanced inputs,
  does the response engage the offered reasoning rather than ask about preferences
  already stated or repeat a generic agreement?
- Does the partner preserve target language/script, persona facts and learner agency?
- Do low-level turns remain one short sentence with one idea? Sentence segmentation
  is only a mechanical screen; clauses and language accessibility need review.
- Does repeated questioning, generic agreement or an imposed persona topic create
  dead ends across the linked turns?
- What are actual prompt/completion tokens, reported cost and latency? Latency is
  descriptive for this run, not a controlled service benchmark.

Decision rule: do not select on sentence count or input size alone. Recommend a
candidate only if it improves concrete conversational behavior without a clear
regression in responsiveness or target-language compliance; report failures and
language-specific limitations. A promising candidate may remain a staged proposal
if low-level compliance is unreliable. No retry-on-style-failure or model switch
is introduced. Do not hide failed examples with an average score.

The recommendation must include exact candidate construction, ownership of persona
projection versus turn/difficulty rules, evidence, remaining risks and finite next
verification steps. No deployment, production prompt edit or commit is authorized
by this evaluation protocol.

Limits: small synthetic sample, single provider/model, unblinded assistant review,
independently assembled prompts rather than native exports. Three-language evaluation
does not certify CEFR fit, dialect quality or transfer to all supported languages.
The concise Absolute Zero guidance uses simple preferences/choices instead of
greeting priming while preserving the approved one-sentence product constraint.
Existing app reading/translation support is outside this experiment.

Budget: 135 + 48 maximum calls on Gemini 2.5 Flash/Google AI Studio, temperature 0.7,
reasoning disabled, 512 output tokens, no automatic retries. Reservations $0.862272
and $0.3065856 respectively, based on current text price ceilings and conservative
input limits. Every actual request and model output is preserved. Stop each batch
on transport, response, model mismatch or truncation failure.

## Targeted revision, specified after the first two batches

The linked candidate reversed first-person ownership in Mandarin; other candidate
outputs pointed at unseen objects or offered little beyond agreement. Revise the
examples candidate with explicit first-person ownership, no implied shared visual
scene, a localized ownership-preserving example and a requirement for a useful new
detail (or reason/counterpoint for reasoned input), except during clarification.

48 paired calls: three languages × two candidates × two repeats × novice opening,
first-person clarification, Beginner preference continuation, Fluent argument about
shorter working weeks. The work argument is new subject matter. Examples do not
contain these ownership-probe sentences. These are development/confirmation probes
chosen after seeing failures, not an untouched statistical holdout.

24 additional linked calls run the revised candidate through the same six four-turn
scripts. Compare against the previously collected chains, acknowledging separate
sampling and the small sample. Maximum extra reservation $0.4598784. Same model,
provider and generation settings; stop at these counts. Report whether the revision
actually fixes the motivating failures rather than assuming the wording works.
