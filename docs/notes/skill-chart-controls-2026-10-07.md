# Skill chart controls and points shown (2026-10-07)

Implemented behavior and verification for the skill chart card
(`ui/src/components/learning/SkillChart.tsx`, `SkillLevelsPanel.tsx`,
`SkillRadar.tsx`, `skill-chart-scale.ts`, `skill-chart-marks.ts`,
`ui/src/styles/components/skill-chart.css`). Decisions below were taken in
session with the owner; open points are listed at the end.

## Decisions

- **Controls live in a row across the top of the chart card**, not behind a
  settings popover. Order: points shown (only where the chart has a
  conversation), chart type, chart scale, zoom at the end. The row never wraps.
- **Folding is measured, not breakpointed.** The row's children are measured
  while unfolded; when they would be wider than the card, type, scale and zoom
  fold into a settings button whose menu is the former popover (closes on an
  outside press or Escape). The row unfolds when the card grows. Measurement
  keeps the behavior language-independent (label widths differ per locale).
  With no points-shown switch, the folded button floats over the chart's top end
  corner instead of keeping an otherwise empty row.
- **Points shown** is a three-way choice, remembered per browser profile with the
  chart type and scale (`skellyspeak_skill_chart_shown`): `language` (totals
  only), `conversation` (this conversation alone), `both` (totals filled, the
  conversation outlined over them, the previous behavior and still the default).
  Charts without a conversation always draw the language, whatever is stored.
- **Conversation alone** takes the skills' place on the chart: its points name
  each arm or bar (`N pt`), there are no earned-level rings (a conversation has
  no level, as the badge glyph already assumed), and normalized the busiest
  skill sits on the gold ring; to scale it keeps the totals' scale and the
  goal in points. The key and legend follow (`Busiest skill in this
  conversation`, `This conversation`); the legend's outline swatch shows only
  for `both`.

## Verification (2026-10-07)

- `SkillLevelsPanel` and `skill-chart-scale` suites cover the row, folding
  (with stubbed measurements), the three points-shown views on radar and bars,
  the stored-choice fallback without a conversation, and the extent rules.
- Full UI suite: 1894 passed; the two failures (`TopBar` globe total,
  `TargetPhrase` toolbars) predate this work and do not touch these files.
- `npm run check:fast` and `npm run build` pass; eight new strings were added
  to all eight interface catalogs.
- Headless renders of `ui/tools/skill-levels-preview.html` (light, dark,
  `?shown=conversation`) and captures of the running desktop app: the 420px
  coach panel keeps the points-shown switch in the row and folds the rest; the
  Skills page chart column and a 360px card keep the full single row.

## Open points

- The folded menu was verified in jsdom and by code review, not captured in the
  running app (the app exited during the session).
- `ui/tools/skill-levels-preview.tsx` now takes `?shown=` and `?chart=` and
  its fixture was reduced to the catalog's eight skills; the coach-panel
  surface there still shows `undefined skill level` because the preview does
  not seed a language name for `ConversationProgress`.
