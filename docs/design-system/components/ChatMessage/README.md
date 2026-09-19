A message bubble in the conversation stream: the partner's (`.msg.chat-message.bot`) or the learner's own (`.msg.chat-message.me`).

Source: `ui/src/styles/features/conversation/messages.css`. The partner's text is rendered by `SavedGlossText` (`ui/src/components/reading/`), which adds word glosses, romanization and pronunciation.

## Variants
- `.bot` — the partner: warm `bubble-partner-bg`, `bubble-partner-line` border, tail (`radius-sm`) bottom-left, max 88% wide. `.focused` darkens the border.
- `.me` — the learner: cool `bubble-learner-bg`, set in the serif, tail bottom-right, max 82% wide.
- `.rtl` — right-to-left scripts: text right-aligned, reading size times `--script-scale`.
- `.pending` — not yet saved: 60% opacity, italic.

## Rules
- Keep warm = partner and cool = learner everywhere the two voices appear (excerpts, reports).
- Glosses (`.wg`) and romanization (`.wroman`) sit under the word in `type-meta`, `ink-3`; never replace the original text.
- Bubbles use `radius-2xl` with one `radius-sm` tail and `bubble-shadow`.
