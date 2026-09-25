# Coach-led conversation selection

Status: implemented in source, 2026-09-24. No model calls, application-data reset,
commit or deployment. The browser review uses production controls with local selection state; it does not start a native conversation.

## Implemented selection policy

One shared native selector uses eligible saved experience and effort credits.
Counts are scoped to the selected language **and exact variety**. Excluded credit
and incompatible catalog records are already removed by the ledger projection.
Generated openings and recommendations are not practice observations and earn no XP.

- **Explore:** choose among skills with the least recorded experience.
- **Continue practicing:** choose among skills with the most retry effort, then
  less experience. No effort history produces an explicit error suggesting Explore
  or Coach's choice; it never invents a claim that the learner is struggling.
- **Coach's choice:** deterministically choose breadth or depth from a hash of the
  conversation/direction, using Explore when there is no effort. This is a simple
  reproducible mixture, not an optimizer or an empirical recommendation model.
- Equal-ranked candidates use the same hash to vary ties across conversations.
  No correctness, confidence, difficulty, assistance discount or proficiency score
  participates. No recency weighting or leveling curve was added.

A worked profile (present 80 experience/0 effort, past 2/3, possession 8/12,
quantity 0/0) selects quantity for Explore and possession for Continue practicing.
This is covered by tests. The absence of recorded quantity experience means an
unexplored area in this app, not inability to express quantity.

## User flow and ownership

The start controls and prompt creator offer **Let the persona decide** separately
from **Let the coach decide**, whose three modes remain visible and selectable in one click. On the
start surface, selecting a mode starts the partner-led conversation. In the prompt
creator it updates the draft for preview/apply. Persona selection explicitly uses
persona details; a custom or built-in topic bypasses coach selection.

Native capture records the selected skill, compact variety guidance, mode,
experience/effort basis, policy identity and direction identity. The partner stays
in character and receives a natural practice opportunity, not an instruction to
examine the learner. The authored instruction requires respecting the learner's
chosen time preference and following topic changes. The same captured skill is
also the coaching focus.

Prompt preview and admission share the read-only selector. The selected target
stays fixed across turns, new experience, retries and unrelated preference changes.
A different direction, variety or skill catalog selects again. Captured counts
remain the basis at selection time; they are not presented as continually refreshed
counts. There is no new persistence table or inference call.

Guide coverage must be complete for the chosen variety before coach-led practice
can start; no language/variety fallback or partial-catalog assessment is implied.
The existing persona/custom-topic route remains available without that coverage.

## Files and review

- `native/src/learning/recommendations.rs`: shared selection, ledger projection,
  captured receipt and prompt addition; no frontend-owned scoring policy.
- `content/prompts/conversation/instructions.yaml#coach_focus`: editable partner
  instruction. Its generated YAML schema is updated.
- `ConversationChoices` / `CoachChoices`: shared start and creator controls.
- Native `TopicChoice::Coach` / generated `RecommendationMode`: closed input
  contract, validated through ordinary start admission.
- `ui/tools/coach-selection-preview.html`: configuration-only review of the production controls. Run the UI dev server and open this path; buttons show the selected
  contract without touching workspace records.

## Verification

- Full native library suite: 601 passed, 1 intentionally ignored.
- Full UI suite: 1,215 passed before adding the additional start-wiring assertion.
- Final focused native checks: **8 passed**. They cover selection, no-history behavior, changing ties,
  variety scope, real retry credit, exclusion, matching preview/capture, no opening
  XP, stable focus after credited activity and unrelated settings, and persona/topic
  bypass. Final UI checks: **78 passed**, covering all three mode callbacks, disabled controls and
  the real start configuration passed to admission.
- Application/preview TypeScript, generated contracts and all seven interface
  locale checks pass. No new prompt-strategy experiment was run.

## Next

Live profile counts and authored guide access are now implemented; see
[the profile checkpoint](saved-experience-assessment.md). Complete the interactive
Spanish pilot before expanding optional drill/card targeting or adding on-demand
score explanations. Bulk authoring remains separate.

## Review follow-up

The accepted control layout keeps all four choices in a single aligned grid,
with responsive stacking, existing choice-card styles, and explanations behind
InfoTip. The technical selection preview remains collapsed. The next product
review is [the live experience profile](saved-experience-assessment.md).
