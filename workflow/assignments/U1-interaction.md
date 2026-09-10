# U1 — Reading and assistance interaction

Read ../README.md, ../../AGENTS.md, ../../DESIGN.md, ../../ui-guidelines.md,
../../STYLE-AUDIT.md and ../../UI-SURFACES.md. Report in workflow/reports/U1.md.
Own src/reading/ and component tests/styles within it.

## Outcome

Design and build a small accessible reading presentation for saved translation and
word/phrase annotations. Use explicitly identified fixture data while L1's contract
is under review. Do not wire production data or invent production token contracts.

## Work

- Specify ordinary word-tap, deeper inspection, touch/keyboard access and how phrase
  spans coexist with word spans. Preserve context and source punctuation.
- Show immediate source text, independently arriving assistance, absent annotations,
  failure and explicit retry intent without a misleading perpetual spinner.
- Components receive data and callbacks. No provider imports, invoke calls, fetches,
  automatic retries or inference effects on mount, reopen or preference changes.
- Reuse current typography, density, colors and interaction conventions. Keep styles
  scoped to owned components; do not stack overrides in root styles.css.
- Review concrete reference interactions read-only where needed; do not run or copy
  the reference app wholesale. Keep production artifact and fixture preview distinct.
- Propose the minimal ConversationView/LearningPanel integration seam to the
  coordinator. Bind to generated production types only after contract acceptance.

## Acceptance

A reviewable component/preview with explicit fixture status; desktop/narrow viewport
and keyboard checks; tests that callbacks fire only for intended actions and renders,
reopens and preferences cause no requested work. Document the exact command to view
it. No invented XP, assessment or motivational statistics. Do not add a separate
production styling system, new dependency or background data loader.
