A small ⓘ button that shows an explanatory note on hover, focus or tap.

Source: `ui/src/components/controls/InfoTip.tsx`, styled by `popovers.css`. The note is a top-layer popover, so scrolling containers never clip it. (The preview is static, so the note isn't shown.)

## What you provide
- `children` — the note: one or two plain sentences.

## Rules
- Use it for caveats and definitions next to a label ("Assessments are model judgments…"), not for instructions the learner needs in order to continue.
- It is keyboard reachable and closes on Escape; don't nest interactive content in it.
