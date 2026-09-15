# Visual vocabulary review

Status: interactive proposal, 2026-09-15. This guide does not change application
styles or establish an approved design system.

Open [index.html](index.html) in a browser, keeping guide.css alongside it. Fonts
load from the repository's ui/public/fonts/ directory; there are no remote assets,
package dependencies or build steps. The entire repository need not be served:
the guide also works as a local file in a browser that allows local files.

Review surfaces and typography first, then controls and conversation reading.
Appearance, palette, density and reading-size controls update the specimens.
Layout spacing offers Roomy, Balanced, Tight and Extra tight presets (desktop
panel padding: 24, 18, 12 and 6px). It independently adjusts section gaps, message
padding and table spacing, leaving text and control dimensions alone. The guide
opens at Tight; Reset choices restores the original Roomy comparison.
A live preview directly below the settings shows measured button height and
reading font size. The settings panel itself stays stable; those controls
change the specimens, not the review interface.
Mode selection, word help, reply disclosure, recording and send controls only
simulate visual states. There is no recording, network submission or persistence.

Cool neutral light follows the supplied reference's palette direction. Warm light
samples active app colors; warm dark is a new exploratory variant. All examples
share new component rules: this is not a faithful rendering of the old app.
The guide intentionally uses self-contained styles rather than importing the
app cascade. It must not become a second production style system.

## Verification

Rendered and inspected the desktop light/default view and dark/warm reading view
at 160%. Verified theme, palette, density and reading-size controls, word-help
visibility, suggested-reply disclosure, and simulated record/send state changes.
At 390px viewport width and 160% reading size, the document width matched the
viewport and conversation layout stacked into one column. Local fonts loaded.
Browser verification used only this newly authored artifact, not the supplied
HTML file that browser policy blocked in the audit.

Full accessibility, native webview, coarse-pointer and platform keyboard testing
remain implementation work. Application source was not modified. See the
[style audit](../style-system-audit.md) for the proposed migration sequence.

## Depth and panel review

Section 05 adds Flat, Subtle and Raised depth treatments applied to the workspace
specimen and its overlays. These are independent of the existing palette, text
and control-density choices. Native dialog/popover elements demonstrate modal
backdrops, scrolling bodies, focus handling and anchored floating surfaces.
The conversation/details divider supports pointer capture, keyboard increments,
Home/End, double-click/reset, and Escape to cancel an active drag. Panels retain
240px minimum widths at desktop sizes and stack below 641px. The split is not
persisted.

Verified pointer dragging (58% to 49%), keyboard resizing (60% to 58%), reset,
and panel shadows across all three treatments. Verified modal Escape dismissal
and return of focus to its trigger. At 390×500, panels stacked, the divider was
hidden, document width remained 390px, and the modal was 468px tall with an
internally scrolling body. These remain review interactions, not production code.
Keep depth.css and depth.js beside index.html and guide.css when opening locally.

### Depth comparison revision

Flat and Subtle initially shared the same main-panel shadow (none). Subtle now
adds a light outer shadow. A permanent side-by-side row shows Flat, Subtle,
Raised and Recessed together; the selector applies one treatment to the larger
workspace. Recessed uses an inset shadow and a quieter background.

Optional colored glow has a color picker and a 0–70% strength slider, off by
default. It is independent of depth: main recessed panels receive an inset glow,
while floating overlays retain an outer glow. Reset restores Subtle with glow off.

The workspace divider rests at 6px and expands to 16px on hover, keyboard focus
or active drag. Resize calculations use the actual divider width, so the split
remains proportional when the handle expands.

## Production-component companion explorers

The UI development server now serves `/tools/style-preview.html` for shared
components and `/tools/detail-style-preview.html` for language and reward
details. These TypeScript previews use current app CSS and real components with
sample data. Start them with `npm run dev` from the repository root; they require
Vite and are not part of this standalone guide's file server.

The detail explorer separates production baselines from proposals for reading
faces, script scale and reward entrance motion. See the
[refactor checkpoint](../style-system-refactor.md) for scope and verification.
