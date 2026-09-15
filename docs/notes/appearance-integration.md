# Appearance integration checkpoint

Status: source integration in progress, 2026-09-15. The application has not yet
been visually verified with these changes. This is not a completed CSS refactor.

## Subsequent CSS refactor

The shared foundation has since been consolidated. See the
[current refactor checkpoint](style-system-refactor.md) for completed ownership,
token/tooling cleanup and verification. The remaining-work list below records
the initial integration state and is superseded by that checkpoint.

## Implemented source changes

- Settings → Appearance contains theme, palette, control density, four layout
  spacing presets, four depth presets, optional glow color/strength and reading size.
- Preferences use the existing learner persistence and settings autosave path.
  Native defaults and validation generate the UI contract. Conversation settings
  remain separate. Reading size now supports 160%.
- The app-level appearance hook applies global theme, spacing, density and surface
  settings; reading scale remains with the reading provider.
- Shared buttons use sentence-case UI typography. Panels and overlays consume
  new surface roles through an initial override sheet. The divider rests at 6px
  and expands to 16px on hover, keyboard focus or drag.
- New labels are present in all seven interface locales.

## Verification so far

- Production build and static stylesheet checks pass.
- Full UI suite: 662 passed and two failed initially. The failures exposed a
  low-contrast faint text color in the cool-light palette and a test assuming the
  previous 150% reading limit. Both were corrected; the two affected suites
  subsequently passed all 23 tests.
- Appearance UI autosave, adapter ownership, root appearance and system theme
  tests passed in the full run.
- Three focused native appearance tests pass, covering validation, defaults and
  persistence across restart without conversation-setting changes. An existing
  serialization expectation was updated for the newly serialized default field.
  The full native regression suite has not been run for this integration.
- No native application launch or browser visual matrix verification yet.

## Outstanding audit work, in order

1. Fix the dead-style scanner's font-URL false positive and unsafe duplicate-rule
   relocation before using pruning.
2. Establish real-app visual/computed-style baselines.
3. Consolidate semantic tokens and remove superseded aliases after migrating
   consumers. The reversed text-xl/text-2xl sizing vocabulary remains.
4. Give shared controls, dialogs, reading and popovers their own style owners.
   Shared dialog bases still live in lesson.css; reading still lives in
   conversation.css.
5. Consolidate control recipes and replace the initial appearance override sheet
   with the actual shared component bases.
6. Simplify feature-specific composition, including conversation.css and
   practice.css. These large files have not been split.
7. Verify light/dark and both palettes, all density/depth options, focus, touch,
   RTL, large reading text, narrow/short screens, overlays and reduced motion.

Keep the appearance preference contract while completing these internal changes.
It represents user choices, not a commitment to the current CSS implementation.
