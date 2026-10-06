# UX redesign: backend findings and required design corrections

Date: 2026-10-06

Status: source review and design handoff. No application, contract, prompt, content-schema or persisted-data changes were made for this review. Optional extensions below are not approved work or promised contracts.

Response to `Claude outputs/ux-redesign-backend-questions.md`.

## Direction from Jon

Revise the design to reflect what the working backend actually produces. A field appearing in a mockup does not establish a requirement to add it to the backend. Do not proceed with unsupported claims, invent missing information, or introduce parsing that disguises unstructured text as a reliable structured contract.

Keep the redesign frontend-only against current contracts. Where a backend improvement might independently be worthwhile, identify the concrete limitation separately for review. Do not make the design depend on that improvement or treat this response as authorization to implement it.

## Answers

Effort estimates describe scope, not commitments. “Small” means a localized projection/contract change with tests; “medium” includes multiple paths, historical data or AI-output validation. Neither means approved.

| Q | Answer | Tier actually needed | Rough effort | Required design response / current behavior |
|---|---|---|---|---|
| Q1: structured guide sections | Partly: the authored source is structured; the returned guide is not | T0 for current Markdown; T1 plus translated-result compatibility work for structured sections | Medium for a complete extension | Render the existing Markdown and use `context` for supported actions. Do not parse the Markdown into an assumed card schema. Authored and translated paths must both work before a structured contract could be promised. |
| Q2: eight overview examples | No to assuming eight cheap guide reads | T0 to omit overview examples; T1 for a separately reviewed offline projection | Small–medium for an extension | An authored edition uses no LLM. A missing edition can initiate a translation; eight distinct skills can mean eight requests. Successful translations are cached, but a cold load is not free. Remove the example-per-skill dependency from the overview. |
| Q3: why this reply counted | No: `rationale` is currently empty | T0 for presence and evidence; T3 for a new narrative reason | Medium for an extension | Remove invented reason lines. Show recorded presence, eligible credit and verified spans when available. Attribution's existing `reason` is a technical localization outcome, not a learner-facing explanation. |
| Q4: reliable evidence spans | Yes to UTF-16; no to guaranteed nonempty spans | T0 | Frontend handling only | `start` is inclusive and `end` exclusive in the original source. Completed attribution can have zero spans and `whole_message` evidence. Do not manufacture a phrase highlight. Two sample records establish no frequency claim. |
| Q5: what was unclear | Partly: some coaching text exists, but no guaranteed reason for the separate verdict | T0 for existing disclosed coaching and choice labels; T3 for a guaranteed assessment explanation | Medium for an extension | Show each signal's actual output. A correction explanation explains that correction; do not present it as the reason for the grammar/understandability choice. Fixed localized choice descriptions are acceptable if clearly generic. |
| Q6: correction scope | No to a reliably narrower issue quote; yes to possible multiple changed regions | T0 | Frontend work and regression coverage | `CoachIssue.quote` and the correction quote come from the same observed item. A diff is presentation only. Preserve the full original/replacement and handle multiple edits, repeated text and non-whitespace-delimited scripts. |
| Q7: casual versus wrong | Partly: metadata exists internally; the requested classification does not | T1 to expose metadata; T3/product-policy work for a reliable new distinction | Small–medium for projection; larger scope for classification | `category` is free text, not a controlled register taxonomy. `blocks_meaning` does not establish whether wording is acceptable or casual. Remove the proposed “Non-standard, common in casual speech” claim unless the actual disclosed explanation says it; do not infer it from a category. No new fields are promised. |
| Q8: which signal wins | No existing cross-signal winner is established by these contracts | T0 to present the signals separately | Frontend policy/presentation correction | Stop counting coach flags as confirmed errors. Show coaching suggestions separately from grammar and understandability. Do not implement the proposed grammar-or-`blocks_meaning` rule as though it were established backend policy. |
| Q9: learner summaries | No: those fields and their translation coverage do not exist | T2 plus loader/projection and translation-field work | Medium, including authored/localized content review | Do not depend on `learner_summary` or `doesnt_count`. Use available labels and guide prose; omit unsupported subtitles. Do not automatically promote assessor criteria or counterexamples into learner guidance. |
| Q10: explanation gist | No: no `gist` is emitted | T0 for a visual preview; T3 for a guaranteed gist | Medium for an extension | Lead with the existing title and collapse/expand the original body. A clipped preview is a preview, not a separately authored summary. Do not assume splitting on punctuation yields a valid first sentence across languages. |
| Q11: structured example/title/CEFR | No structured example or emitted CEFR; sentence-case output is not guaranteed | T0 to preserve current text; T3 for changed output/prompt | Medium for structural changes; smaller for prompt wording alone | Render `example` as the supplied string. Do not regex-split it into asserted text/translation fields. Preserve title text rather than lowercasing linguistic material. Omit CEFR: the view adapter currently supplies `null`. |
| Q12: XP versus points | Partly: one current skill credit is one XP and one point; Experience is not always equal to either | T0 | Frontend semantics correction | XP comprises Experience plus Effort. Effort is real revision credit. A compact total may be shown, but retain access to the distinction and do not describe all points as independent new replies or demonstrated mastery. |
| Q13: all evidence | Yes: the snapshot is unpaged for the selected language's matching records | T0 for display pagination; backend pagination would be separate work | Frontend list work now; scaling work unestimated | “Show all” can reveal more already-loaded eligible records. Do not imply it fetches another backend page. Long histories increase query, serialization and memory costs; hundreds of conversations have not been benchmarked in this review. |

## Important implementation details

### Guides and guide actions

`SkillGuideResult` returns Markdown, explanation language, generated status, optional action context and provenance. `context.subskills` is a list of IDs; `context.examples` is a flat list of source example strings. Neither supplies localized structured teaching cards.

The authored renderer combines shared concepts and language-specific explanations by subskill ID and may append a variety supplement. Preserve that teaching content and its ordering. A card redesign must not quietly omit the introduction, supplementary guidance or example notes.

For generated translations, the current translation code reconstructs translated content and renders it to Markdown; retained results store that rendered result. Returning correctly translated structured sections is more than exposing the original YAML. Substituting source-language sections beside translated Markdown would be incorrect. Existing cached results also need a deliberate compatibility strategy for any future extension.

`startSkillConversation` is not just `(skillId, subskillId)`: it requires a source conversation, language, variety and expected revision. `askGuideCoach` requires a conversation, valid guide reference and expected revision. Its subskill focus is `{kind: 'subskill', subskillId}`. A standalone Skills page must establish the appropriate conversation context or present an explicit route to do so; do not assume these actions are context-free. Preserve the returned guide reference, including its source-edition identity on translated guides, rather than reconstructing it from display language.

### Evidence and credit

Skill attribution is separate from awarding credit. Its model output contains skill IDs and quote occurrences, not a rationale. Native validation resolves those quotes against the exact original source, enforcing grapheme boundaries and exporting UTF-16 offsets. Check `source.slice(start, end) === quote` before highlighting. Do not normalize the displayed source or offsets.

The snapshot currently emits `rationale: ""`. Attribution reasons such as `localized`, `not_localized` and `unmatched_quote` describe whether quotes could be anchored. They do not explain why a skill was credited. An empty span array can also occur before attribution is available: preserve pending/failure state instead of presenting every `whole_message` record as a completed localization result.

If a narrative reason is proposed later, note that the current attribution request includes the learner message and skill definitions, not the preceding exchange. It cannot safely invent the conversational context behind a contextual judgment.

Use the existing eligible credit projection/index to decide what earned credit. A positive judgment alone is insufficient: exclusions, registry compatibility, revision history and the saved reward ledger matter. Use the credit for the specific attempt and skill, not the skill's lifetime XP total. Some evidence presentations produce multiple spans for one credit; do not sum those rows as separate awards.

Under current `experience-effort-1` behavior, a credited skill receives one XP. A skill not previously credited within that revision chain gets Experience; a changed revision repeating a previously credited skill gets Effort. An unchanged revision gets no new credit. Effort is not a measure of time spent, difficulty or grammatical failure. Skill-level points count eligible credits. A single reply can credit multiple skills. If using “counted replies,” scope it to the individual skill and account for credited revisions; summing skill points does not count distinct replies.

Levels and `holdingBack()` can support the proposed progress display, but these are practice levels, not proficiency or CEFR assessments.

### Feedback and correction display

The current badge chooses “Errors found” whenever coach flags exist; it does not reconcile those flags with the grammar assessment. The flag helper also labels proposed corrections as errors. This explains the observed contradiction. It is a presentation problem, not evidence that either AI output should overwrite the other.

Use a neutral coaching label such as “Suggestions” or “Feedback,” while displaying grammar and understandability as separate assessments. Do not turn a suggestion count into an error count. Missing, pending, failed or partially omitted feedback must not become “Clean.” Keep technical omission notes available; they are not explanations of what the learner did wrong.

`meaningRecovered` is a separate coaching judgment. Item rationale is retained in the summary for items without an error; error-item rationale is withheld there and supplied with explicit correction disclosure. Respect the existing disclosure/keep-going flow. Do not extract hidden explanation text or assume every rationale explains an assessment choice.

A correction's `text` is a replacement only for the `explicit` move. Other moves contain hints, elicitation or metalinguistic help. Apply original/replacement diff presentation only where the move actually supplies a replacement. Issue quotes are not independently narrowed ranges, and coaching validation can retain non-verbatim quotes: underline only exact source matches. Repeated matches are ambiguous without occurrence information.

A whitespace-only word diff is not a shared cross-language solution. Use Unicode-aware segmentation, preserve original strings and show the full pair when a compact diff would be unclear. Test separated edits, insertions/deletions, combining marks, emoji and scripts without spaces. Do not treat visual shortening as newly validated error evidence.

### Partner-message analysis

The actual card fields are `quote`, `title`, `body`, `example` and `contrast`. The current schema allows zero to two cards. Zero cards is a supported result. `cefr` is absent from native `ReplyExplanation`; the UI adapter fills it with `null`.

Quotes are requested verbatim but validation permits nonmatching quotes. Numbered anchors therefore require exact matches and a defined treatment of repeated occurrences. Keep an unmatched card readable without pretending it has a verified location in the message. Do not change source text to force a match.

The example is unstructured text. Parentheses can be part of an example, and no contract says its final parenthesis contains a translation. Display it intact. Titles, examples and quoted grammatical terms must not be rewritten by generic sentence-case transformations.

## What to revise before implementation

1. Update every mockup annotation to name an actual returned field and its empty/pending/failure behavior. Remove fields that do not exist.
2. Separate the coaching, grammar, understandability and skill-credit presentations. Do not invent a single winning verdict or cross-signal explanation.
3. Use the current Markdown guide and existing action ownership requirements. Remove automatic overview translation dependencies.
4. Show Experience/Effort semantics correctly and preserve whole-message evidence without fabricated phrase ranges.
5. Keep partner explanation text intact, with collapsible presentation rather than inferred structure.
6. Return any remaining design limitation as a specific proposal for separate review. Do not proceed on an assumed future backend change.

Frontend work can proceed within these corrected boundaries. This is not approval of the original mockups or of the requested backend extensions.

## Source basis and verification limits

Reviewed active source, including the shared checkout's in-progress changes. This is a source-level review, not a running-app inspection, benchmark or validation of the external Design canvas.

- Guides and translation: `native/src/configuration/guide_translation.rs`, `native/src/configuration/communication_guides.rs`, `native/src/application/commands/skill_guides.rs`.
- Action ownership: `native/src/storage/store/commands/guide_actions.rs`, `ui/src/features/conversation/session/useConversation.ts`, `ui/src/generated/contracts.ts`.
- Evidence and snapshots: `native/src/learning/coaching/skill_attribution.rs`, `content/prompts/assessment/evidence-attribution.md`, `native/src/learning/learner/progression.rs`, `ui/src/domain/learning/evidence/message-evidence.ts`.
- Credit and levels: `native/src/learning/practice.rs`, `native/src/learning/learner/skill_levels.rs`.
- Coaching: `native/src/learning/coaching/mod.rs`, `native/src/learning/coaching/coach_observation.rs`, `native/src/learning/coaching/coach_policy.rs`.
- Feedback presentation: `ui/src/domain/conversation/coach-marks.ts`, `ui/src/features/conversation/coaching/MessageFeedback.tsx`.
- Partner analysis: `native/src/learning/coaching/conversation_support/types.rs`, `native/src/learning/coaching/conversation_support.rs`, `ui/src/domain/conversation/conversation-view.ts`.
