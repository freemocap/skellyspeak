# Style system refactor

Status: shared foundation implementation, 2026-09-15. Feature composition cleanup
is still outstanding. This updates the original audit and initial appearance
integration checkpoint; neither should be read as the current completion report.

## Basis adopted

Use one role vocabulary for general surfaces/text, ordered layout spacing,
control sizing, shared controls and overlays. Reading/script behavior and
status/learning-domain meanings are independent roles. See the maintained
[UI guide](../../ui/README.md#shared-style-vocabulary) for the concrete map.

## Implemented

- Retired 33 redundant text-size and shell/paper aliases; migrated consumers,
  including contrast checks, to their canonical roles.
- Removed 69 unreachable legacy numeric palette entries after tracing dependencies
  through all retained token/theme branches and checking TypeScript consumers.
- Shared buttons, fields, panel headers, dialogs, popovers and reading styles now
  have explicit owners. Shared dialog bases no longer belong to lessons.
- Moved shell notices and Settings forms to their respective owners.
- Replaced the initial global Appearance override sheet with component-owned
  surface/shadow rules. Settings' own Appearance layout lives in its feature sheet.
- Button/tab/AI-status control families share UI typography and density.
  Form labels use ordinary UI text; composer reading typography remains explicit.
- All spacing steps scale together, preserving ordering at every spacing preset.
  Reading scale and control heights remain independent; coarse-pointer density
  enforces the 44px target. Shared fields no longer suppress keyboard outlines.
- The scanner reads selectors, not font URLs/comments/declaration strings.
  Pruning conservatively retains functional/escaped selectors and refuses
  duplicate relocation without writing any files.
- Reviewed eight unused class candidates; removed their 13 rules.
- Added a real-component review fixture using production CSS, Appearance controls
  and saved-gloss components. It has no native calls or saved preferences.

## Verification

- Production build, stylesheet validator and graph/tool TypeScript check passed.
- Final full UI suite: 667 tests passed in 107 files after spacing/touch polish.
- Final build, stylesheet checks, tool TypeScript and documentation links pass.
  Dead-style report: zero candidates. Vite retains its existing bundle-size warning.
- Keyboard navigation to the shared field shows a solid 2px focus outline.
- Browser fixture: standard/compact controls measured 40px/32px; dark recessed
  shadows and colored glow inspected; dialog backdrop and Escape verified.
- At 390×500, 160% reading text measured 32px with no horizontal overflow.
  Content remained scrollable and the dialog stayed within viewport bounds.
- This is component-fixture verification, not a native application launch or
  a complete visual regression matrix across every product surface.

## Remaining work

1. Migrate conversation composition, composer/pickers, messages and reply help
   onto the shared families; remove redundant contextual overrides.
2. Continue through coaching/lessons, settings and skills. Split remaining mixed
   feature sheets by their actual owners; avoid arbitrary line-count splits.
3. Review retained semantic aliases/palette roles as their consumers migrate.
4. Verify each real application surface across layout, focus, touch, reading,
   LTR/RTL, modal/popover, busy/error and reduced-motion states.

## Agreed follow-up: detailed explorer

After this foundation cleanup, extend the style explorer for language-specific
fonts, script scaling, RTL, gloss/romanization/pronunciation and mixed-script
content; reward tiers, colors, animations, reduced motion, sounds/haptics and
dense evidence states; and remaining detailed control/overlay states. This is
a design review follow-up, not authorization to erase or redesign existing
language/reward behavior during structural cleanup.

## Conversation pass

Implemented after the shared foundation:

- Replaced the mixed conversation sheet with workspace, messages, composer,
  reply-help, header, start, reading-evidence and inline-rewards owners.
- Activity indicator and waveform rules moved to shared component owners;
  modal overscroll moved to dialogs. The ordered manifest includes every owner.
- Removed repeated bubble background/border, picker presentation and stream
  declarations; consolidated composer geometry and removed superseded scrolling
  declarations. Functional reward and language styling remains intact.
- Named the stream bubble variant `chat-message` and the field variant
  `composer-input`. Partner excerpt differences remain explicit in persona CSS.
  Header comments explain the two picker placement variants.
- Extended the production-CSS fixture with messages, an excerpt, picker row and
  composer. Compared 12 computed properties across ten representative elements
  before/after: no differences in the captured desktop fixture.
- At 390×500 with 160% reading, text measured 32px; document and chat had no
  horizontal overflow, and composer controls fit. This is fixture verification,
  not a native app launch or a full mobile keyboard/device test.

Final conversation-pass checks: production build, style validation, documentation
links and all 667 UI tests pass. Dead-style scan reports zero candidates.

Next: coaching/lesson and practice/inspection composition. The language/reward
explorer remains a dedicated follow-up, including state and accessibility review.
