The coach's saved judgment of one learner message: a remark, corrections and two 1–5 scores.

Source: `ConversationFeedbackCard` in `ui/src/features/conversation/coaching/`, styled by `coach.css`. Built from `.coach-entry`, `.coach-card`, `.coach-assessment` and `.coach-meter`.

## Props the caller provides
- `feedback: ConversationFeedback` — `remark`, `corrections[]` (`said`, `corrected`, `explanation`), `grammar` and `conversation` (1–5), `usedTarget[]`, `usedNative[]`.
- Optional `onAsk(question)` — makes terms in the explanations open a coach question.

## Rules
- A correction reads "said → corrected": the original struck through on `danger-tint`, the fix on `success-tint`, both in the serif.
- Meters colour by level (low / partial / strong) and always show the number ("3/5") too.
- Feedback is a judgment of a message, separate from skill evidence and XP. Don't mix them in one card.
