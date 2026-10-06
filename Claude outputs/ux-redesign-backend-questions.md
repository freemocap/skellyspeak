# UX redesign: questions for the backend agent

From: frontend UX/UI agent · Via: Jon · Date: 2026-10-06

## What this is

The frontend is redesigning four screens: the Skills page, Skill detail (replacing the skill modal), the Feedback dialog on a learner message, and Message analysis on a partner message. The mockups are on a Design canvas Jon can show you. Every element on them is tagged with where its data comes from.

The goal is to ship with **no backend, prompt, data-model or authored-content changes**. Where a small change would make a big UX difference, the change is listed below as a question. Please answer each one, and push back if the cost isn't worth it.

### Tiers

| Tier | Meaning |
|---|---|
| T0 | Frontend only. Uses data already in the contracts. |
| T1 | Expose data the backend already has (contract or IPC change, no prompt or model change). |
| T2 | Authored content change (YAML under `content/` plus its schema). |
| T3 | Prompt or AI output change (new field, new call, or changed output schema). |

### How to answer

Copy this table, fill in one row per question, and add notes below it.

| Q | Answer (yes / no / partly) | Tier you'd actually need | Rough effort | Notes / alternative |
|---|---|---|---|---|

---

## Already confirmed as T0 (no action needed, correct me if wrong)

- Skill levels: `SkillLevelSummary` (points, level, thresholds, bands) and `holdingBack()` drive "2 skills away from Level 1" and the per-skill bars.
- "Practise X" buttons use `Action.startSkillConversation(skillId, subskillId|null)`. Per-way "Ask the coach" uses `askGuideCoach` with `focus: {kind:'subskill'}`.
- Feedback dialog: the correction comes from `CoachDecision.shown` / `CoachObservationView.corrections` (`quote`, `text`, `explanation`). The frontend trims the common leading and trailing words of `quote` and `text` so it shows only the changed phrase ("Ain't no one → No one has") instead of striking out the whole sentence.
- Grammar and understandability verdicts come from `ConversationFeedback.answers.{grammar,understandability}` (`choice`, `probabilities`, `confidence`). The frontend writes fixed learner-facing copy for each choice.
- Skills a reply earned use the existing `MessageSkillAnalysis` rows plus the `skillIndex` entry XP.
- Message analysis cards use `ReplyExplanation` (`quote`, `title`, `body`, `example`, `contrast`). The frontend finds each `quote` in the reply to place numbered marks, folds every card except the first, and shows the first sentence of `body` as the card's lead line.

---

## Questions

### Skill guide

**Q1. Structured guide sections (T1).** `getSkillGuide` returns `SkillGuideResult { markdown, context: { subskills, examples } }`. The redesign shows each subskill as a card: title, concept, explanation, first example, and its own buttons. That data already exists as YAML (`skills/<id>/<id>-explained-in-<lang>.yaml` plus `languages/<lang>/skills/<id>/…-explained-in-<lang>.yaml`).
- Can `SkillGuideResult` also return `sections: [{ subskillId, title, concept, explanation, examples: [{ text, meaning, note }] }]`, alongside the markdown?
- Fallback: the frontend parses the markdown, which breaks whenever the guide template changes.

**Q2. Guide cost on the Skills page (T0/T1).** The Skills page wants one example sentence per skill (8 skills).
- Does `getSkillGuide` call an LLM when the explanation language has an authored edition (for example, English explained in English)?
- When it doesn't have one, is it OK to call it 8 times on page load, or should the catalog carry one cheap `example` per skill per language?

### Skill evidence

**Q3. Why a reply counted (T0 if populated, else T3).** The Skill detail page wants one short line per credited reply ("Gives an opinion about bullet buses").
- Is `SkillJudgment.rationale` populated under the default `assessment_adapter: jev_choice`?
- If not, could the evidence-attribution call (`prompts/assessment/evidence-attribution.md`) also return a learner-facing `reason` of 20 words or fewer?
- Fallback: show only the presence label ("Used directly" / "Completed in context") and highlight the spans.

**Q4. Span reliability (T0).** We want to highlight `judgment.spans` inside the reply bubble.
- Are `start`/`end` UTF-16 offsets into `record.source`?
- When `attribution_state` is complete, is `spans` always present, or only when `evidence_kind === 'quoted'`?
- The two real records we checked are both `whole_message`. Is that the common case?

**Q12. XP vs points (T0).** On the current Skills table, Experience, XP and points are always equal, and Effort is always 0.
- Is one credited reply always exactly 1 XP and 1 point for skills?
- If yes, the UI shows one number ("counted replies").
- What is Effort, and should the skills screens show it at all?

**Q13. All evidence for a skill (T0).** Skill detail lists a skill's credited replies with a "Show all" control.
- Is `SkillSnapshot.records` complete in memory, or paged?
- Is there any size concern after hundreds of conversations?

### Feedback on learner messages

**Q5. What was unclear (T3).** When understandability is `needs_clarification` or `unrecoverable`, or grammar is `local_errors` or `major_errors`, the learner gets a verdict with no reason. The current adapter returns only a choice and probabilities.
- Is there existing output that already says what was unclear (coach `notes`, `items[].rationale` with `meaning_recovered: partial`)?
- If not, what is the cheapest way to get one line?
- Fallback: fixed copy per choice ("Your partner can follow part of this but may need you to clarify something.").

**Q6. Correction scope (T0, confirm).** `Correction.quote` is often the whole sentence. The frontend will diff `quote` against `text`.
- Is `CoachIssue.quote` reliably narrower, so we could underline that instead?
- Can a correction ever change several separate places in one quote? The diff handles that, but the layout differs.

**Q7. Casual or non-standard vs wrong (T1).** `ErrorTag` has `category`, `source` and `blocks_meaning`, but `CoachObservationView` drops them.
- Can `Correction` and `CoachIssue` expose `category` and `blocks_meaning`?
- Does the taxonomy distinguish register or non-standard forms ("Ain't no one") from errors? That lets the UI say "Non-standard, common in casual speech" instead of implying a mistake.

**Q8. Which signal wins the headline (policy).** In the real example, grammar is `acceptable` at 83% while the coach still shows an explicit correction, and the badge under the message says "Errors found".
- What is the intended rule?
- Proposal: the badge counts coach flags as "suggestions". It says "errors" only when grammar is `local_errors` or `major_errors`, or when `blocks_meaning` is true.

### Plain-language skill text

**Q9. Learner-facing skill summaries (T2).** The catalog's `description` and `criterion` are written for the assessor ("epistemic limits", "establish referents", "judge the actual function").
- Would you accept two optional authored fields per skill definition (language-agnostic, 8 files plus the schema)?
  - `learner_summary`: 8 words or fewer, e.g. "Say what can, may, must or might happen".
  - `doesnt_count`: one line, which the existing subskill `counterexample` could seed.
- These need translation into each explanation language, like the other guide text. Is that already handled by `guide-translation.md`?
- Fallback: keep showing `description` and `criterion` as they are.

### Message analysis (partner messages)

**Q10. One-line gist per explanation card (T3).** `ReplyExplanation.body` is long. The redesign leads each card with one plain line and folds the rest.
- Can the explanation output schema add `gist` (one sentence, 20 words or fewer) and the prompt ask for it?
- Fallback: the first sentence of `body`, which is often long and technical. Real example: "The phrase "nunca había escuchado" uses the imperfect tense of "haber" (había) with the past participle "escuchado" to form the past perfect, or pluperfect."

**Q11. Structured examples and titles (T3, low priority).**
- `example` is a string like `Cuando llegué, ella ya se había ido. (When I arrived, she had already left.)`, which the frontend splits with a regex. Could it be `{ text, meaning }`?
- Titles come back in Title Case ("Past Perfect Tense"). Could the prompt ask for sentence case, to match the app?
- Is `cefr` actually emitted? `ExplanationCard` has the field.

---

## Priority from the UX side

1. Q8 and Q7: the feedback badge currently contradicts the grammar verdict.
2. Q1: the skill detail page depends on it.
3. Q3 and Q5: one-line reasons make the verdicts make sense.
4. Q10: makes Message analysis scannable.
5. Q9, Q2, Q11: polish.
