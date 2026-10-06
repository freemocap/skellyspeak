# UX redesign: frontend revision after backend review

Date: 2026-10-06 · Responds to `docs/notes/ux-redesign-backend-response.md`

## Status

The Design canvas is now frontend-only against current contracts. Nothing in it depends on a backend, prompt, schema or content change. Every element is tagged with:

- the field it reads (green tag)
- presentation-only frontend logic (blue tag)
- its empty, pending and failure behavior (dashed tag)

The `showSources` tweak hides all of these tags.

## What changed in the design, per the review

| Review point | Design now |
|---|---|
| Q1 structured guide | The Skill guide panel is the existing `SkillGuideResult.markdown` rendered by GuideDocument and restyled with CSS only. Intro, order, meaning and notes are kept. No Markdown-to-card parsing. Variety selector, loading, error and "AI-generated translation" states are kept. |
| Q2 overview examples | Removed from the Skills page. Cards show `catalog.description` only. |
| Q3 why it counted | Removed. Credited replies show `presence` ("Direct use" / "Fits the exchange"), "Whole message", the attempt's own credit ("+1 XP · Experience/Effort"), and the assistance line. |
| Q4 spans | Highlight only when `source.slice(start, end) === quote`. `whole_message` gets no highlight. Pending attribution shows "Locating evidence…"; `attribution_error` shows ErrorNotice with retry. |
| Q5 / Q8 verdicts | The coach suggestion, grammar, partner understanding and skill credit are four separate sections. Grammar and understanding show `choice`, probabilities and clearly generic per-choice copy ("Means: …"). There is no cross-signal headline. |
| Q6 diff | The compact diff applies only to the `explicit` move, uses Unicode segmentation, and shows one row per changed region. The full original and suggestion are always available (open by default). The bubble underline uses exact `quote` matches only. |
| Q7 casual vs wrong | Removed. |
| Badge | "N suggestion(s)" instead of "Errors found". Missing, pending or failed feedback never shows "Clean". |
| Q9 summaries | Not used. |
| Q10 gist | Removed. Folded cards show title, quote and a 2-line CSS clamp of `body`, presented as a preview, not a summary. |
| Q11 example / title / CEFR | The example is shown as one intact string. Titles are shown exactly as returned. CEFR is not shown. 0 cards → "Nothing to flag in this reply." |
| Q12 XP | "Points" means credits per skill. "Counted replies" is gone. The skill header shows XP, Experience and Effort. The Skills page has an "XP by skill: Experience and Effort" disclosure. Levels are called practice levels, not proficiency. |
| Q13 show all | "Show N more" reveals snapshot records already loaded, with no fetch. |
| Action ownership | The Skills pages are opened from a conversation, which supplies `sourceConversationId`. Buttons read "New conversation: …" / "Practise in a new conversation". With no source conversation they are hidden. Guide buttons keep `context.reference` as returned. |

## Separate proposals (not dependencies, for review only)

Each one names the limitation that remains in the current design. None is needed to ship.

1. **Credited replies give no learner-facing reason.** Today the learner sees only a presence label. A narrative reason would need T3 work. It would also have to account for the attribution call lacking the preceding exchange.
2. **Assessment verdicts give no specific reason.** "Needs clarification" can only show generic copy. A per-message reason would need T3 work.
3. **Guide sections cannot be laid out individually.** For example, the five subskills cannot become side-by-side cards or carry per-section credit indicators; we are limited to restyled Markdown. This would need T1 work plus support for translated guides.
4. **Explanation cards have no authored one-liner.** Folded cards rely on a clipped preview of the body. A `gist` field would need T3 work.

## Frontend implementation scope (when approved)

1. `MessageFeedback.tsx`: change the badge label to "suggestion(s)" and stop presenting coach flags as errors.
2. `CoachEntry.tsx`: Unicode-segmented compact diff for `explicit` only, with the full pair kept.
3. `ConversationFeedbackCard.tsx`: two separate check tiles, generic per-choice copy, probability bar.
4. `ExplanationCards.tsx`: exact-match number marks in the reply, 2-line clamp, example kept intact.
5. Skills page and skill detail: replace the table and the modal, restyle GuideDocument with CSS, list credited replies.
