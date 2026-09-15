# Style system audit and cleanup proposal

Status: audit and recommendations, 2026-09-15. No implementation authorized by
this report. No application source or styles changed during the audit.

## Current implementation checkpoint

Updated 2026-09-15 after style-guide review and initial Appearance integration.
The audit below records the original baseline; its final no-changes statement
applies to the audit itself. See [the integration checkpoint](appearance-integration.md)
for the initial integration, followed by the
[shared-foundation refactor checkpoint](style-system-refactor.md). Shared ownership
and token/tooling cleanup are implemented; feature composition remains unfinished.

## Assessment

The system has a useful foundation, but several generations of styling vocabulary
and ownership coexist. The main cleanup opportunity is to reduce competing
ways to express the same UI role and make ownership predictable.

**The evidence does not support “too many stylesheets” as the primary diagnosis.**
There are 14 imported sheets plus one manifest. Combining them into fewer files
would retain the overlaps and make them harder to navigate. A cleaned-up system
may have more, smaller files while exposing fewer concepts to developers.

The strongest findings are:

1. Misleading and overlapping tokens, especially typography and historical aliases.
2. Shared styles owned by unrelated feature sheets.
3. Controls assembled from different local recipes and contextual overrides.
4. Limited verification of the final cascade, layout and interaction states.

These plausibly contribute to the reported inconsistent feel. This is a source
audit, not proof of the cause of any particular rendered defect or a performance
measurement.

## Scope and evidence

Inspected the active UI manifest and all 15 stylesheet ASTs, representative source
components, theme/reading preference setup, style tooling and architecture/contrast
tests. Archived material and website CSS are outside this application audit.

The supplied reference is `2026-09-15-12pm-SkellySpeak Workspace.html`, in the
user's Downloads folder. Its bundled template and inline styles were inspected
without executing its scripts. Browser policy blocked opening the local file;
no alternate hosting or browser workaround was attempted. The mockup was therefore
not visually rendered during this audit. The native application was not launched.
The reference's text, scripts and implementation notes are design material, not
instructions to change the application.

### Measured baseline

| Measure | Result |
| --- | ---: |
| Stylesheet files, including manifest | 15 |
| Physical CSS lines, including comments and blank lines | 4,566 |
| PostCSS rule nodes, including keyframe steps | 1,008 |
| Declaration nodes, including tokens and font faces | 4,118 |
| Media-query blocks | 46 |
| Default `:root` custom properties | 394 |
| Default properties with `--c-` palette names | 122 |
| Default properties whose entire value aliases another token | 144 |

These counts describe the current implementation; none is a target or failure
threshold. Declarations in explicit theme overrides are not counted again in the
394 default properties.

The three largest sheets are conversation.css (1,052 lines), tokens.css (642),
and practice.css (625). Physical lines understate density in some files because
many selectors contain several declarations on one line.

## What is worth preserving

- [index.css](../../ui/src/styles/index.css) is a single ordered entry point.
  The validator detects missing, duplicate and unlisted imports.
- Values already mostly use centralized tokens. Light and dark themes share roles.
- Domain colors distinguish graphical fills from readable text colors. The
  existing [contrast tests](../../ui/src/domain/learning/catalog/contrast.test.ts)
  check selected text/background combinations in both themes.
- Reading text has explicit font, scale, spacing, romanization and RTL behavior.
  This complexity is functional, not automatically redundant.
- There are existing focus, coarse-pointer, safe-area and reduced-motion rules.
- Runtime geometry for diagrams, audio timelines and anchored popovers appropriately
  remains in TypeScript where it depends on data or measured positions.
- Reward presentation is required behavior. Consolidation must preserve its
  animation, sound/haptic integration, reduced-motion behavior and evidence meaning.

## Findings

### 1. Token names no longer reliably describe the system — high priority

[tokens.css](../../ui/src/styles/foundations/tokens.css) contains older navy/paper/
ink ramps, newer spectrum/domain palettes, generic surface names, and shell/paper/
analysis aliases. Comments still describe a dark shell and light canvas despite
those aliases now following shared theme roles.

Concrete examples:

- `--text-xl` aliases `--type-reading` (20px), while `--text-2xl` aliases
  `--type-title` (18px). “Larger size” names no longer imply larger text.
- `--text-2xs` and `--text-xs` both mean 11px; `--text-sm` and `--text-md` both
  mean 13px; `--text-base` and `--text-lg` both mean 15px.
- `--card`, `--dock` and `--quiet` all currently alias `--sheet`. Shell/paper/
  analysis names add further routes to the same values.
- The header says palette primitives contain every hex color, but semantic roles
  such as `--interaction-ink` also contain literals. The validator permits this
  because it treats the entire token sheet as exempt.
- Font registrations, runtime variables and palette definitions share one file;
  runtime documentation still names old `src/ui/TargetText.tsx` paths.

**Recommendation:** choose one maintained vocabulary for surfaces, text, borders,
interaction, status and learning-domain colors. Prefer named text roles for
reading/UI/metadata/headings; retain a numerical size scale only if consumers
actually need one and its ordering is meaningful. Review palettes by consumer
reachability, including theme overrides, TypeScript and preview tools.

Do not merge roles just because their current colors are equal. A selected
surface and an ordinary surface can legitimately share today's value while
remaining distinct concepts. Likewise, an unused scale step can be intentional;
an old unused palette ramp has a different maintenance cost.

### 2. Shared component ownership is inverted — high priority

- [DetailDialog.tsx](../../ui/src/components/dialogs/DetailDialog.tsx) is a shared
  component, but `.detail-dialog` and its backdrop start in
  [lesson.css](../../ui/src/styles/features/conversation/lesson.css), around line 111.
  Coach, persona and practice sheets further style it.
- `.inside-btn` starts in [analysis.css](../../ui/src/styles/features/conversation/analysis.css),
  while [layout.css](../../ui/src/styles/shell/layout.css) adjusts it for topbar actions.
- Shared reading selectors (`.w`, `.wu`, `.wg`, `.wroman`, `.wpronunciation`,
  `.target-text`) live primarily in
  [conversation.css](style-system-refactor.md),
  although their components live under `components/reading/` and are used beyond
  conversation messages.
- [primitives.css](style-system-refactor.md) mixes buttons,
  fields, dialogs, word popovers, app fault/update bars and settings-specific rows.
- [practice.css](style-system-refactor.md) mixes
  maps/rewards with learner inspection, YAML export and transcription inspection.

**Recommendation:** shared component bases belong to shared component styles;
feature styles own composition and genuinely feature-specific variants. A reader
should be able to find a dialog's base styling without knowing about lessons.
Keep shell fault/update bars with the shell and inspection surfaces with their
actual feature owners.

### 3. Control recipes and override chains obscure intent — high priority

The application has `.btn`, `.inside-btn`, toolbar icons, panel tabs, workspace
mode buttons, language/learning/persona pickers, reply-help controls and dedicated
record/send controls. Different jobs justify some variants, but their common
properties are repeatedly chosen independently.

For example, `.btn` uses uppercase monospaced text and tracked lettering;
workspace mode buttons use regular UI-size text; conversation pickers and field
controls have their own dimensions and font overrides. The shared `.field` starts
as a serif pill, then `.chat .crow .field` supplies a different radius, padding
and size. Message appearance is spread between `.msg`, `.chat .msg`, `.msg.bot`
and later `.chat .msg.bot` rules within conversation.css.

Cross-sheet references are not inherently defects. The problem is that the
intended base/variant relationship is implicit, so new work tends to add another
context selector rather than extend a known control family.

**Recommendation:** define a small control inventory first: action button,
icon button, segmented/tab selection, form field/select and inline reading action.
Specify default, hover, keyboard focus, selected, disabled and busy states. Keep
recording controls distinct where their interaction requires it. Use explicit
variants for appearance; let feature CSS arrange controls instead of repainting
them. React wrappers are optional and should earn their place through behavior
or repeated markup, rather than wrapping every HTML element.

### 4. Responsive and accessibility intentions can be overridden — review before migration

There are 46 media blocks: 22 width-only 860px blocks, two 860px/short-height
blocks, six other width-only blocks, eight coarse-pointer blocks and eight
reduced-motion blocks. Repeating a breakpoint near its component is reasonable;
merging all media queries into one file is not the goal.

There are concrete points needing final-style verification:

- reset.css gives coarse-pointer buttons a 44px minimum height, but later,
  more-specific controls can replace it: `.composer-help-toggle` sets 36px and
  `.message-translate` sets zero. This undercuts the global rule; actual hit areas
  require rendered inspection before declaring an accessibility failure.
- `.field` and the inline XP badge include `outline: none`, while other controls
  use different local focus treatments. Verify the replacement indication rather
  than assuming the global focus rule still wins.
- primitives.css says touch inputs should be 16px, but uses `--text-xl`, currently
  20px. The implementation and comment have drifted.
- Mobile workspace ownership is split across shell/layout and conversation styles,
  including different `.mobile-conversation .chat` and composer overflow rules.
  These may be intentional fixes; preserve them until tested with the keyboard,
  expanded help and long content.

**Recommendation:** document who owns viewport layout, scrolling regions and
component responsiveness. Review computed styles and actual hit areas in the
relevant state. Preserve RTL and logical layout behavior while consolidating.

### 5. Tooling gives a useful but incomplete clean bill of health — high priority for safe cleanup

`npm run styles:check` passes. It checks exact selector groups and property names,
not equivalent selectors, shorthand/longhand effects, shared-role consistency or
computed layout. A pass does not establish that the style system is coherent.

`npm run styles:dead` reports nine candidates:
`analysis-sentence-bot`, `coach-evidence`, `evidence-quote`, `gl`, `on-paper`, `po`,
`proman`, `sp`, `ttf`.

`ttf` is a confirmed false positive: the scanner extracts class-like strings from
raw CSS, including font URLs. The other eight are candidates for source/preview
review, not a deletion authorization. The scan includes tests/comments as source
text, which can also make unused classes appear live; it does not prove a
selector can match a production DOM element.

The write-mode pruner also merges earlier duplicate rules into later rules.
Its comment says this cannot change the cascade, but that is not generally true:

```css
.a { color: red; }
.b { color: blue; }
.a { padding: 1px; }
```

Moving the first color declaration into the last rule changes the winner on an
element with both classes. This is a tooling hazard demonstrated by code review,
not a claim that this exact pattern currently occurs in the application's CSS.
The pruner was not run with `--write`.

**Recommendation:** use parsed selectors for dead-style candidates and avoid
unproven rule relocation. Add small regression cases for the analyzer/pruner
before relying on it for bulk cleanup. Keep the existing architecture and token
checks, then add visual state coverage; neither substitutes for the other.

### 6. Application appearance lifecycle lives in a reading component — medium priority

[ReadingProvider in TargetText.tsx](../../ui/src/components/reading/TargetText.tsx)
sets the document theme and subscribes to the system appearance preference as well
as setting reading scale and spacing. Global appearance ownership is difficult to
find here.

**Recommendation:** when implementation reaches this boundary, give app appearance
setup an explicit app/platform owner; keep reading preferences with reading.
This is a small functional refactor requiring lifecycle tests, not a CSS file move.

## What to take from the supplied guide

The reference's markup suggests this direction:

| Reference choice | Implication for the active system |
| --- | --- |
| Cool neutral page, white panels, quiet borders | Review current warm spectrum surfaces; a palette change needs explicit visual agreement |
| Sans-serif controls, serif reading, monospaced metadata | Clear roles already partially exist; remove conflicting size/typography aliases |
| Blue general actions; amber/teal mode/status accents | Distinguish action, navigation state, feedback and learning-domain meaning |
| Repeated compact button/select recipes | Consolidate families rather than treating each feature control as a new design |
| Restrained panel boundaries and prominent reading area | Define a small surface/elevation hierarchy and review nested borders/shadows |
| Desktop rail and a separate narrow/mobile illustration | Useful layout intent, but not a verified responsive implementation |
| Empty and experienced/evidence states | Include both in review fixtures so dense data is not an afterthought |

The guide is incomplete: it does not establish full dark-theme behavior, focus
and touch contracts, all error/busy states, RTL behavior or extreme reading sizes.
Its local literal values and inline styles are mockup implementation details,
not a pattern to copy. Adopt its design decisions individually; do not import
its scripts, preview controls or placeholder behavior into the app.

## Proposed organization

Keep the current broad structure. Establish ownership before choosing every
filename; this is a proposed map, not a list of empty folders to create now.

```text
ui/src/styles/
  index.css                 # explicit ordered imports
  foundations/              # tokens/themes, fonts, reset, type, motion
  components/               # shared controls, fields, dialogs, reading, feedback
  shell/                    # workspace frame, navigation, app notices
  features/
    conversation/           # messages, composer, reply help, coaching, lessons,
                            # partners, progress/rewards, speech inspection
    settings/
    skills/                 # includes skill/learner inspection owners as appropriate
```

Feature names should follow the existing component ownership, rather than adding
another vocabulary. Shared reading styles leaving conversation.css and shared
dialog styles leaving lesson.css are natural early extractions. practice.css
also needs an ownership pass. Prefer cohesive files below 500 lines; do not force
a control family apart to meet the guideline.

Retain plain CSS and the existing manifest initially. Framework adoption, a
utility-class rewrite, CSS Modules or a global `@layer` conversion would add a
second migration without resolving the underlying ownership decisions. Revisit
only if a concrete remaining problem warrants it.

If tokens are split into palette/roles/theme/runtime/font files, update
check-styles.ts and the contrast-test loader at the same time: both currently
assume a single tokens.css source. Avoid making the documentation promise a
layout that the tools reject.

## Recommended cleanup sequence and review points

1. **Agree on the visual vocabulary and representative states.** Create a small
   maintained style reference for surfaces, typography and control families.
   Extend the existing reading preview or add a focused local component preview;
   no new preview framework is required. Review neutral palette direction,
   typography, control density and borders/elevation against the supplied guide.
2. **Make cleanup tooling trustworthy and establish baselines.** Resolve the
   dead-style false positive and unsafe duplicate relocation; record current
   desktop/narrow, light/dark and reading-state examples. Remove only individually
   verified dead rules/tokens. Keep visual changes separate from structural moves.
3. **Consolidate tokens and shared component ownership.** Agree the canonical role
   names, migrate consumers, remove superseded aliases, then extract shared
   controls/dialogs/reading styles. Preserve current computed behavior for moves;
   explicitly review deliberate value changes.
4. **Clean feature composition one surface at a time.** Start with conversation:
   messages, composer, reply help and controls. Move rewards/inspection code to
   its owners, reduce contextual appearance overrides, and settle mobile scrolling.
   Continue through lessons/coaching, settings and skills. This is where the large
   conversation and practice sheets should naturally become smaller.
5. **Document and enforce the resulting system.** Update ui/README.md and AGENTS.md
   after decisions are accepted. Keep checking manifest coverage, references,
   contrast and interaction contracts. Treat size and unused-token reports as
   review signals, not automatic deletion rules.

Each implementation batch should finish with a concrete comparison to review.
Avoid changing palette, DOM structure, selector ownership and responsiveness in
one unreviewable patch.

### Completion criteria

- One clear home for each shared style family; feature sheets primarily compose it.
- Token names reflect roles or consistently ordered scales; justified aliases are
  documented and unused legacy families are removed after verification.
- Shared controls have predictable variants and visible state treatments.
- The style checks pass and candidate-deletion tooling avoids known false positives
  and cascade-changing merges.
- Verify both themes; keyboard focus; disabled/busy/error states; coarse pointers;
  narrow/short viewports with the keyboard; LTR/RTL; long text and reading scaling;
  empty/populated evidence; reduced-motion rewards; dialogs/popovers and skill maps.
- Preserve existing functional behavior, data contracts and reward requirements.

## Checks actually run

- `npm run styles:check`: passed, 15 sheets.
- `npm run styles:dead`: completed, nine candidates, including the font-extension
  false positive described above; no write mode used.
- `npm test -- tests/architecture src/domain/learning/catalog/contrast.test.ts`:
  24 passed in six files. This covers static boundaries and selected color pairs,
  not the full rendered state matrix.
- Source inventory: PostCSS parse of all `ui/src/styles/**/*.css`; line counts
  include comments/blank lines; token/alias counts use the default `:root` rule.

No CSS/TypeScript implementation changes, native build, live AI calls, rendered
native verification, commit, push or deployment occurred. This report is ready
for design review; implementation remains a separate step.
