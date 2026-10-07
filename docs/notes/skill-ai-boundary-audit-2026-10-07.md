# Skill teaching and AI boundaries

## Finding and decision

Learner guides and assessment instructions already have separate source owners.
Keep that separation; do not duplicate every lesson into a new AI-only document.
The English, Spanish and Arabic rewrite changed learner-guide editions and shared
learner explanations, not definitions or language assessment YAML. New languages
must retain that boundary and review assessment consistency if a linguistic
correction changes what should count as successful communication.

| Consumer | Sources used | Effect of teaching rewrite |
| --- | --- | --- |
| Jev skills, grammar and understandability | Skill definition purpose/boundary, selected language/variety assessment, shared assessment instructions and message questions | Full request and assessment hash unchanged |
| Automatic coach feedback | Learner wording, captured construct criteria, language guidance and feedback policy | No learner-guide prose input |
| Reply explanations | Skill IDs, names, definition overviews and observed evidence | No learner-guide prose input |
| Selected-skill partner conversation | Shared concept/title and selected guide section explanation | Changed; excludes principal examples, meanings and notes |
| Explicit guide coaching | Selected guide Markdown, selection and reference attached to coach context | Changed intentionally; examples explicitly described as teaching, not performance evidence |
| Generated explanation translation | Selected editable prose fields with source examples as context | Changed; main example strings remain source-owned |

Relevant owners: `native/src/configuration/skills.rs`, `skill_conversation.rs`,
`guide_translation.rs`; `native/src/learning/coaching/assessment_adapter.rs`,
`mod.rs`, `conversation_support.rs`; `native/src/storage/store/commands/guide_actions.rs`.
The general configuration/communication hash changes with teaching edits; the
assessment-specific hash does not. Existing durable assessment captures are not
rewritten.

## Authoring guidance adopted for the continuing rollout

Keep `section.explanation` declarative and contextual because the partner receives
it as practice focus. Place learner-directed exercises and their answers in
`examples.note`. Preserve selected-variety accuracy in every edition. Use inline
target markup only for target-language words/forms. Assessment guidance remains
compact recognition criteria with boundaries, ambiguity and valid alternatives;
it is not a second textbook. Cross-review should compare what a lesson teaches
against what its existing assessment permits, rather than assuming separate files
alone guarantee semantic consistency.

## Verification

Added a native regression covering all eight groups, six English/Spanish/Arabic
language-variety pairs and their existing explanation editions (112 rendered
guide-edition cases). Mutating teaching titles, concepts, explanations, meanings,
notes, examples and selected-variety replacements changes rendered lessons but
leaves the complete ten-question request, serialized bytes and assessment hash
unchanged. Positive controls mutate assessment guidance and require changes in
both request and hash. Targeted test passed.

Eight paid Jev calls used the current native ten-question request composer, not a
handwritten approximation. Three explicit ability cases, three cases where only
the partner expressed ability, one repeat and one embedded-instruction case all
matched their provisional focal skill expectations. All returned valid distributions.
Reported cost: $0.00162267. The embedded-instruction case received local-errors and
needs-clarification message labels; those were not prespecified quality targets.

Six paid generation calls used messages exported from actual synthetic native
AskGuideCoach and SendMessage captures: English, Spanish and Levantine Arabic,
one ability-coaching question and one skill-focused partner reply per language.
Gemini 2.5 Flash, Google AI Studio endpoint, no fallback or retries. All completed;
inspection found conversational partner answers without unsolicited teaching and
coaches explaining forms without asserting demonstrated learner proficiency.
Reported cost: $0.00432240. Combined spend: $0.00594507.

These are synthetic smoke checks, not expert linguistic certification or a
reliability estimate. They do not establish performance for other models, every
skill or every variety. No real learner conversation was transmitted, and no
inference output was published to the app or credited as learner evidence.
Exact payloads, price snapshots, attempts and receipts are local run artifacts
under `skill-ai-boundary-2026-10-07/`; the reproducible TypeScript runners are
retained there. The ignored native exporter uses temporary workspaces only.

## Follow-up risks, not resolved by this smoke test

1. Guide coaching validates target language ownership but can attach a selected
   guide variety differing from the conversation's base coach variety. Clarify
   that the selected guide variety owns explanations of the attached material.
   The smoke fixtures selected matching varieties and do not cover this conflict.
2. Translation replaces prose fields, including inline target fragments and worked
   answers inside them. Principal example strings are protected structurally, but
   exact inline target text and Markdown boundaries are currently protected only
   by model instructions. Add preservation validation before relying on generated
   translations as equivalent to the authored editions.
3. Partner focus places teaching explanation in its system context. Existing
   instructions prohibit quizzes and teaching commentary; explicit reference-data
   delimiting would make that boundary clearer. Keep exercises out of this field.
4. Larger lessons approach fixed UTF-8 context/output budgets. Current code rejects
   oversize inputs and incomplete outputs; it does not silently truncate. Keep
   budget checks in integration and review generated-translation capacity separately.

The user directed continuation with French, Italian and German, followed by
Vietnamese, Mandarin and Cantonese. These risks are recorded independently of
the approved content rollout; no new AI-guidance schema has been adopted.
