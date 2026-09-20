# Language selector update — implemented

The top-bar selector now uses a wider disclosure with the current language and
variety on separate lines. Each saved language exposes all bundled varieties on
hover or through a keyboard/touch-accessible button. Choosing the language uses
its remembered variety; choosing a variety uses the existing settings writer and
durable targetVarieties preferences. Escape returns focus to the selector.

The language browser now presents a responsive checkbox grid. Add selected
languages writes the whole selection in one revision-guarded learner update,
preserves remembered varieties and the active conversation, and adds each base
language once. Variants do not require individual membership. Existing inspection,
single-language actions and removal remain available below the grid.

Settings → Languages → Restart onboarding enables the existing reviewSetup path.
The row was previously disabled by omission from the supported-settings set.
Restarting preserves existing learner preferences and language membership.

## Verification

- Full UI suite: 133 files / 836 tests passed.
- Subsequent expanded browser/onboarding tests: 23 passed.
- Subsequent hover-then-click regression check: 4 picker tests passed.
- Production build, style validation, preview type checking and localization
  usage audit passed. Vite retains its existing large-bundle advisory.
- Regenerated the design-system CSS bundle from production styles.
- Browser review used production components with disposable sample state:
  verified the checkbox grid, adding French and Arabic together without changing
  Spanish, the widened selector and expanded Arabic varieties.
- Native application restart/persistence was not manually exercised. Persistence
  uses the existing native preference contract and its automated adapter checks.

Changes are uncommitted. Existing unrelated workspace edits were preserved.

## Cascading-menu correction

The initial inline variant disclosure is superseded. The dropdown now matches
the trigger width exactly. Each language is one full-width row with a trailing
arrow; clicking or hovering that row opens a separate floating variety menu
beside the parent menu, aligned with the row. Clicking the language no longer
changes the active conversation; selecting a variety commits the selection.
The submenu flips sides when space requires it and adjusts vertically at the
viewport edge. Arrow keys navigate rows and enter/leave the submenu.

Verified the corrected layout in the browser preview, including the Arabic
side menu. Picker and shell tests: 17 passed. Production build and style check
passed; design-system CSS regenerated.

## Selection indicators and phone layout

Added a persistent leading checkmark to the active language and each language's
remembered variety. Empty indicator space keeps unselected rows aligned.
Hover/expanded-row colors no longer carry the only visible selection signal.
The active language also exposes aria-current; varieties retain aria-pressed.

On narrow screens the submenu stays inside the viewport, overlaps the trailing
portion of the parent if necessary, and wraps long labels. The existing 44px
coarse-pointer target minimum is retained. Resizing/orientation changes dismiss
the menu so fixed submenu coordinates cannot become stale.

Browser verification at 390×844: opened Arabic by click, selected Modern
Standard Arabic, reopened the menu, and confirmed both checkmarks moved to
Arabic / Modern Standard Arabic. This used sample state, not a physical phone.
Picker and shell tests: 19 passed; style validation passed.

## Inline identity and concise variety names

The selector now places language and variety horizontally, with natural flex
wrapping when their combined labels exceed available space. This supersedes
the original mandatory two-line layout. The arrow stays at the trailing edge.

Reviewed all 12 language YAML configs. Arabic was the only language whose variety
display names repeated its name: now Levantine and Modern Standard. Stable IDs,
descriptions and teaching guidance remain unchanged. Updated all seven interface
translations and the content authoring guide; preview/test fixtures use the
shortened labels.

Verification: 31 relevant UI tests, UI production build, styles validation and
localization usage audit passed. Parsed all language YAML files and checked that
no variety name repeats its complete parent language name. Browser preview
confirmed the horizontal Arabic / Modern Standard label at desktop and phone
widths. Regenerated the design-system stylesheet.

Native language-content and generated-contract checks are blocked by the existing
unrelated references.bib error: invalid review state in umapParameters. The
language-check command stopped before running its native configuration tests.
No edits were made to that bibliography entry.

## Bibliography startup refusal repaired

The UMAP exploration added three bibliography entries with explanatory prose in
the enum-valued review field. The registry validates the entire bibliography at
startup, so this blocked application initialization even though these sources
were only used by exploration tooling.

Normalized umapParameters, umapClustering and sklearnTrustworthiness to
review = {reviewed}, preserving each original review phrase in note. Citation
keys, URLs, claims and exploration code are unchanged. Documented the accepted
values and startup coupling in content/README.md.

After repair, content validation and generated-contract checks pass. Updated
only Arabic variety labels in the frozen resolved-context fixture to reflect
the earlier requested rename; all 30 configuration tests now pass. This
supersedes the native-check blocker recorded above. An already running binary
must be rebuilt/relaunched to incorporate the embedded bibliography.

## Immediate membership and editable language display

Supersedes the earlier batch-add interaction: membership checkboxes now save
immediately in either direction. Removed Add selected languages, Add language,
Use now and separate removal buttons from the browser. The active-language
removal guard remains; clicking a name inspects without switching conversations.
Failed checkbox writes leave the saved membership unchanged and show the error.
Retired the unused batch writer and its confirmation-only translations.

Language details are always rendered in the scrollable dialog. The overview
places identity and variety controls alongside one another when space allows;
detail cards and writing/source tiles distribute across the available width and
stack on narrow screens. The language-details collapse has been removed.

Script size now has a per-language learner override (50–300%, with Default to
remove the override). Rust owns persistence and validates language IDs and finite
bounds. Its generated contract exposes optional scriptScales; no database reset
or schema migration was needed. Content scalars.font_scale remains the default
and is not modified by user changes. ReadingProvider applies the override
independently of overall reading scale, and original-script examples use it.
The resolved-source inspection continues to show the actual bundled value.

Verification:
- Full UI suite: 133 files / 838 tests passed.
- Native preference tests: 14 passed, including restart persistence and invalid
  script-size rejection.
- UI/native builds, preview type check, contract check, style validation and
  localization usage audit passed; regenerated design-system CSS.
- Browser preview verified immediate checkbox addition, always-visible details,
  phone-width layout, and selecting script size. Preview writes use sample state;
  native persistence was verified by the store test rather than a physical phone.
- Changes remain uncommitted.

## Fine script-size adjustment

Replaced the preset percentage dropdown with a decimal scalar input and slider.
The number field accepts arbitrary decimal precision within the existing
0.5–3.0 range and saves on blur/Enter. The slider uses 0.01 increments, mirrors its
draft in the input and saves on release or completed keyboard adjustment.
Moving focus through the slider does not round an entered value such as 1.375.
Default removes the stored override. Empty/out-of-range input remains visible
with a validation error instead of being saved.

Verified exact 1.375 input in the browser. Twelve relevant UI tests, production
build and style validation passed; design-system CSS regenerated.

## Follow-up: compact writing and reading layout

Removed equal-height writing-fact cards, which stretched short values to match
the script-size editor. Facts now wrap as compact label/value pairs; the number,
slider and reset button share a row. Romanization examples are grouped into
responsive tables of at most four rows, keeping each original beside its reading.
Detailed romanization instructions are collapsed. Font sizes and script-scale
behavior are preserved.

The production-component fixture at `/tools/writing-preview.html` includes all
ten Arabic examples. Desktop and 390px layouts were visually inspected; controls
wrap and examples use a single column at narrow widths. Language and reading
component suites passed all 47 tests. No commits or deployment.

## Direct language information shortcut

Each dropdown language row now has an independent information icon. It opens the
language browser on that language and its remembered/current variety without
switching the conversation or changing membership. Generic browser entry points
clear the explicit target. Icons remain keyboard-accessible and use 44px minimum
touch targets on coarse pointers.

Verified direct Arabic navigation in the production-component browser preview.
Build, style validation, preview type checking and 32 relevant tests passed.
Regenerated design-system CSS. The separate My languages button remains removed.

### Reading font display

The language details' Writing and reading facts now include Reading font. The
value resolves the current reading CSS font stack against bundled font-face
Unicode ranges and the language's native name, so script-specific font changes
are reflected without a duplicate language/font mapping. This identifies the
configured family; it does not measure platform glyph fallback. The complete
configured stack is available in the field's title. Labels cover all seven
interface locales.

Verification: 17 focused font-resolution and language-browser tests passed;
production UI build and localization validation passed. Browser preview showed
Skelly Arabic Reading for Arabic and Noto Sans Devanagari when switching to Hindi.
