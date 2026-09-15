# U1 — Inline conversation controls

Base: integration checkpoint b68c64a. Direct user correction: keep Difficulty inline with both language selectors, match global styling, and remove the redundant Lesson & coach button.

## Implemented

- `src/styles.css`: constrained three-column selector grid; native selects use existing dark surface, border, typography and focus tokens. Full option lists cannot force Difficulty onto another row. Narrow layouts retain all three selectors together and put actions below; hidden visual labels retain accessible names.
- `src/pages/GuidedPage.tsx`: removed Lesson & coach, which only opened the existing panel and selected Lesson. Existing panel tabs, desktop collapsed-panel opener and mobile Lesson navigation remain. Removed its unused callback prop from this component, `src/App.tsx`, and the conversation test fixture.
- `ui-guidelines.md`: header acceptance now requires the complete language registry and a long synthetic option, rather than a single-option fixture. This supersedes the earlier header correction's wrapping allowance.

No production contract or inference behavior changed.

## Verification

Explicitly labeled no-inference browser fixture uses the actual header component with all five registry languages plus a synthetic long option. At a 590 px conversation pane, all three selects share top 50 px and height 30 px; header height is 49 px across all five difficulty values. At viewport width 390 px, all three selects share top 33 px, width 118 px and height 30 px; actions occupy the second row and header height is 85 px. Screenshots inspected at both sizes. Accessible selector names remain available.

Code Quality independently checked the source, desktop values and narrow long-option geometry; no blocker. Existing desktop opener/shortcut, panel tabs and mobile navigation remain in source. This is browser-fixture and source verification, not a claim of native/device interaction QA.

Final gates: `npm run build`, `npm run styles:check`, and `npm test` passed (82 files, 391 tests). Source is frozen for Integration. No Git mutation, runtime restart or provider call performed.
