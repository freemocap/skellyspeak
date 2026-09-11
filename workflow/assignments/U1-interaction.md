# U1 — Reading and assistance interaction

## Current ownership and UI standards

Interaction owns UI implementation, component choices, styling and detailed UI rules. Integration relays user corrections, coordinates contracts and file ownership, and reviews handoffs; it does not take over UI implementation. Apply this division on every assignment.

Preserve the approved reference presentation and follow `ui-guidelines.md` and established CSS/component patterns for every UI change. Never introduce unstyled controls. A defaults-only request authorizes filling existing configuration, not adding a setting or behavior toggle. Flag material product changes before introducing controls; do not infer permission for them from implementation or cleanup authorization.

Current source is frozen after the Custom model-default correction. No further UI changes are requested. The earlier approval gate and candidate reading assignment below are historical scope; current explicit user authorizations and coordinated assignments govern subsequent work.

## Approval gate

Proposal/design conversation with the user comes first. Investigate read-only and
present your recommendations directly in this domain chat. Do not implement source,
code prototypes, install dependencies or run implementation builds/tests until the
user explicitly approves the domain's implementation scope. The work and acceptance
sections below describe candidate work after approval, not immediate authorization.
Preserve and disclose existing preliminary edits without treating them as accepted.
Coordinator review cannot substitute for the user's approval.


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
