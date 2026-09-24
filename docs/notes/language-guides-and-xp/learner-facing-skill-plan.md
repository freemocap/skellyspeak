# Shared skills and language guidance

Status: **agreed direction and accepted first-pass definitions**, 2026-09-24.
The user accepted twelve compact shared skills. Exact assessment semantics and
three scope questions below remain open. This is content design, not implemented
catalog behavior. See [the full refactor plan](evaluation-xp-refactor-plan.md).

## Decisions

- Use twelve shared skills for the initial pass, not the earlier 28-node tree.
- Categories organize browsing; they are not scored roots. Skill connections
  express composition, not mandatory inheritance or unlocks.
- Skill definitions contain a name, overview and essential boundary. Identity,
  applicability, category membership and connections are separate metadata.
- Progression is separate from skill definitions and language guides. It is not
  another skill tier or a required part of each assessment prompt.
- Languages and varieties can define additional skills using the same structure.
  A different grammatical realization alone needs guidance, not a duplicate skill.
- Language guides have shared language cores and connected variety sections.
  Arabic core does not mean MSA. Levantine must have directly applicable guidance.
- Assessment instructions, learner evidence and deterministic XP have separate
  responsibilities. Explanations are on demand and do not gate initial scores.
- No compatibility, old-ID preservation, old-skill crosswalk or data migration is
  required. Replace obsolete behavior and reset affected development data at
  implementation. The old system imposes no design or coverage obligations.
- Plain functional labels; no promotional or patronizing text.

This replaces the earlier four-entry/eight-beginner/sixteen-intermediate plan and
its marketing-style family names. Older exploration notes are historical proposals.

## Twelve definitions accepted as a first pass

| Category | Skill | Overview | Boundary |
| --- | --- | --- | --- |
| People and things | Identify and describe | Identify a person or thing, or express its qualities, state, or location. | Naming something does not by itself demonstrate describing it. |
| People and things | Express possession and relationships | Express who something belongs to or how people and things are related. | Possession, access, and association do not necessarily imply ownership. |
| People and things | Express quantity | Express how many, how much, or which portion of a group or amount is meant. | Distinguish quantities from numbers used as names, dates, or identifiers. |
| Time and events | Describe present situations | Express what happens, holds, or happens regularly in the current time frame. | Present meaning does not require a particular verb form or an explicit time word. |
| Time and events | Refer to the past | Express that a situation or event occurred before now or an established reference time. | Judge the expressed time relationship, not the verb form alone. |
| Time and events | Refer to the future | Express that a situation or event is expected, intended, or placed after now or an established reference time. | A wish or possibility alone does not establish future reference. |
| Wants and choices | Express wants and preferences | Express what someone wants, likes, dislikes, or prefers. | Distinguish a desire from a prediction, requirement, or request. |
| Wants and choices | Express ability, permission, and necessity | Express what someone can do, is allowed to do, or needs or is required to do. | Distinguish these meanings from one another and from likelihood or inference. |
| Wants and choices | Affirm and negate | Affirm or deny a proposition, making clear what is accepted or rejected. | Determine what the affirmation or negation applies to; a negative word alone is insufficient. |
| Questions and conversation | Ask and answer questions | Request information or provide an answer that addresses the information sought. | A question-shaped request for action is not necessarily a request for information. |
| Questions and conversation | Make and respond to requests | Ask someone to act, or accept, decline, or negotiate a request. | Distinguish requesting an action from merely describing a desire or asking about ability. |
| Questions and conversation | Explain reasons and conditions | Express why something happens or holds, or under what circumstances it would happen or hold. | Distinguish a reason from a condition; sequence alone establishes neither. |

These are composable capabilities, not all-or-nothing achievements. Evidence for
permission is not automatically evidence for ability or necessity. Assessment
must retain enough detail to avoid making such claims; its output design is pending.

## Division of labor

| Content | Responsibility |
| --- | --- |
| Shared or language-defined skill | Concise meaning and essential boundary |
| Language guide | Teaching explanation, worked examples and connected varieties |
| Assessment guidance | Evidence criteria, ambiguities and context requirements |
| Progression | Developing control across skills and contexts; separate design |
| XP policy | Credit for observed practice, assistance and revision |

Prompt composition selects from the authored sources. A compact prompt should
not become a second independently maintained definition. How much of a guide is
included is an experimental question, not a decision to send full lessons each turn.

## Open scope questions

1. Identify and describe includes location: is that boundary sufficiently useful?
2. Does Describe present situations primarily assess present reference or basic
   event description? Distinguish these in worked assessment cases.
3. Possibility and uncertainty are not explicitly covered by the twelve. Decide
   whether to broaden a definition, exchange a slot, or leave them outside this pass.

## Next content checkpoint

Keep the discussion and specimen review in chat before moving definitions into
YAML. Draft one concise structural specimen and a composed prompt example, then
review it. Spanish possession and Arabic past reference are the initial contrasts;
prior chat examples have not received linguistic/source verification. Broader
language generation waits for the experiment and content-structure checkpoints.
