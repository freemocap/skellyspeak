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

## Coaching, lessons, progress and inspection pass

Implemented: separated the 625-line practice sheet into progress maps, reward
presentation, numeric reports, learner-model tables, YAML export and speech
inspection. Coaching dock/explanation layout and skill evidence no longer belong
to lesson flow. Shared error details have a component owner.

Consolidated identical inspection controls using the explicit `inspection-action`
class. Wide report dialogs now select `size="wide"` rather than duplicate width
rules keyed to their contents. Retained and documented meaningful variants:
study coaching versus bounded threads, dock versus floating reward cards, boxed
learner records versus conversation evidence, and transparent table-heading
buttons versus ordinary actions. Removed superseded declarations and restored
keyboard focus visibility on the coach input. Reward timing, language treatment,
plot geometry, persistence and data behavior were not redesigned.

Verification: production build and stylesheet checks pass; zero dead-style
candidates; all 667 UI tests pass. The existing Vite bundle-size warning remains.
Browser fixture checks exercised the production YAML dialog, its 40px actions,
preserved YAML indentation, Escape dismissal and a 390×500 viewport (354px dialog,
no horizontal overflow). Keyboard navigation to the coach textarea shows a solid
2px outline; the sample evidence table and document fit the narrow viewport.
These are fixture checks, not a full native application/device visual matrix.

Remaining: final Settings/Skills composition audit and cross-surface consistency
review, then the agreed detailed language/reward style explorer.

## Settings and Skills consistency pass

Implemented: split Settings into shell, access, audio and reset owners, keeping
form variants with forms. Split Skills graph/vendor rendering, inspector and
review composition from page/list layout. Removed superseded mobile Settings
padding and duplicate form declarations. Restored search keyboard focus.

Fixed the page-level Skills font selector that overrode control typography.
Settings search, access tabs, checkbox-row spacing and Skills toolbar controls
now consume the control-density role. Preserved joined route tabs, destructive
reset presentation, scoped vendor overrides and the recessed inspector as
documented variants. No graph geometry or reward/domain colors were redesigned.

Verification: production build and the current full suite (664 tests) pass.
Browser fixture measurements: Settings search and Skills action/select controls
use 13px text and 40px standard / 32px compact heights. Search keyboard focus has
a solid 2px outline. Compact dark rendering at 390px fits without horizontal
overflow. These checks do not constitute a full native Settings workflow or
interactive React Flow visual regression.

The planned ownership passes are complete. Remaining verification includes a
full native-app walkthrough across supported layouts, real data, graph navigation,
overlay stacking and accessibility states. Some retained semantic aliases and
specialized controls can be evaluated during those focused reviews. Next design
work is the agreed language-specific and reward-detail explorer; do not describe
all visual inconsistencies as resolved merely because static checks pass.

## Language and reward detail explorer

Review artifact: `ui/tools/detail-style-preview.html`, served by the UI dev
server at `/tools/detail-style-preview.html`. The shared-component preview links
to it. Both previews share sample settings in `ui/tools/preview-settings.ts`.

Implemented in the explorer only: six language specimens, gloss/romanization/
pronunciation toggles, independent reading and script scales, serif/sans choices,
domain-colored reward badges, three existing sound tiers, stored versus new
credit, full and compact inspection cards, and a real evidence dialog.
Audio is opt-in and starts off. Stored evidence does not replay a celebration.
The proposed entrance respects the system reduced-motion preference.

The reading components, badges, sound patterns and dialog use production code.
The reading-face override, specimen-wide script scale, gentle entrance and
pending/no-credit wording are explicitly exploratory. No learner data is read,
written or credited, and preview choices do not save application preferences.
Font selection per language, annotation hierarchy, reward motion and native
haptics remain review decisions, not implemented product changes.

Verification: production build and the separate preview TypeScript check pass.
At 390px width, combined 160% reading and 160% script scales produce 51.2px
annotated text without horizontal overflow in any of the six specimens.
The evidence dialog fits the narrow viewport and closes with Escape. Stored
credit suppresses replay; opt-in audio successfully schedules the existing
sound helper. This is browser fixture verification, not an auditory assessment
or a full native reward, font, touch or screen-reader test.

## Refactor closeout and script-scale decision

Agreed: script scale belongs to language configuration, with `1.0` as the
standard. The existing `scalars.font_scale` field already resolves through Rust
to the UI's `fontScale` and CSS `--script-scale`; no second setting or contract
was added. Arabic's `1.5` and Mandarin's `1.3` moved from shared script defaults
into their language YAML files, preserving their effective sizes. Shared script
defaults are now `1.0`. Existing workspace configs remain workspace-owned.

The detail explorer now exposes a separate scale per language, initialized with
those bundled examples. Both Arabic specimens share the same control state.
This supersedes the specimen-wide script slider described above. Preview changes
are still temporary and do not edit YAML or app preferences.

The agreed CSS ownership/consolidation pass is complete. The detail explorer is
available for future focused design work. Full native-app walkthroughs, actual
reward travel and haptics, speech/audio mixing, script font selection and assistive
technology checks remain explicit follow-up work. These are not claims of
completed validation, nor reasons to keep expanding this refactor's scope.

Closeout verification: all 672 UI tests and 18 configuration tests pass, as do
the production build, preview TypeScript check, stylesheet and documentation-link
checks. The style manifest has 48 sheets and the dead-style scan reports zero
unused-class candidates. Vite retains its existing large-bundle warning.
Browser verification confirms changing Arabic's scale updates both Arabic
specimens while leaving Spanish, Chinese, German and French scales unchanged.
