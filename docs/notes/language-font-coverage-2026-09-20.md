# Language font coverage — 2026-09-20

## Finding

Arabic writing now includes vowel marks, exposing crowded mark positioning in
the device fallback used by the former Latin-only reading stack. Source inspection
found no separate scaling of letters and vowel marks. Whole-word shaping already
exists. The screenshot alone cannot identify the exact original system font.

Only Newsreader, IBM Plex Sans and IBM Plex Mono were bundled. All four non-Latin
scripts depended on device fonts. Cmap inspection also found missing reading-aid
letters: the Plex fonts lacked `ḍḥṣṭẓʿʹ`, while Newsreader also lacked sampled
pinyin caron vowels. Coverage and appropriate font design are separate concerns.

## Implemented

- Locally bundled Noto Naskh Arabic, Noto Sans Devanagari, Noto Sans Malayalam,
  Noto Sans SC and Noto Sans. Script-specific families and regional CJK variants
  follow Noto's organization [@noto_script_families2026].
- Range-restricted script fonts precede the Latin role fonts, including in fields,
  interface labels and mixed-language text. Noto Sans is the extended fallback;
  reading aids use it as a complete face to keep diacritics consistent.
- Existing font-size multipliers, text content, shaping boundaries and spacing
  settings are unchanged. No per-mark positioning hacks or letter spacing added.
- Complete WOFF2 conversion, with all cmap entries unchanged and GPOS/GSUB retained.
  Five assets total 8.85 MiB, 7.42 MiB of which is Chinese. Files are loaded as
  required by browser font selection and available offline after installation.
- Font hashes, source revision and licenses live beside assets. Production font
  declarations are retained in generated design-system CSS; staging copies all
  bundled font files and licenses. Nothing was published.
- A production-component comparison preview covers all 12 current languages,
  Arabic stacked marks, mixed scripts, transliteration, word help and composer.

## Verification

- Binary cmap audit: native names, greetings, default partner names and all
  authored romanization examples in all 12 language definitions are covered by
  the bundled font union. A focused extended-transliteration sample is entirely
  covered by Noto Sans. This checks samples, not every possible language character.
- WOFF2 conversion retained each input cmap and both OpenType shaping tables.
- Browser preview reports all five Noto faces loaded. Visual comparison shows
  different, clearer Arabic mark placement at equal CSS size; desktop and narrow
  previews inspected, including 200% reading size.

## Remaining limits / extension policy

This is a script-default strategy, not universal language coverage. Current
Simplified Chinese selection must not be treated as Japanese, Korean or
Traditional Chinese typography. Additional language-specific styles need
appropriate BCP-47 boundaries on the actual source/explanation text, as well as
font selection. No YAML font field or learner font picker has been added. See
`ui/public/fonts/README.md` for the extension procedure.

Native desktop/mobile webviews and native-speaker evaluation remain necessary.
No Android/iOS application or native desktop build was launched in this pass.
System fonts remain the final fallback for unbundled characters. An optional font
pack system is a future decision if broad script coverage makes bundles too large.

Automated verification completed: `npm run build`, `npm run styles:check`,
`npm run previews:check`, `npm run design-system:check`, and all 35 tests in
`npm test -- src/components/reading` passed. Source font hashes, copied production
assets and packaged licenses match. Vite still reports the existing large
JavaScript chunk advisory. A repository-wide whitespace check reported an
unrelated trailing blank line in `features/activity/ai-view.css`; the changed
font files pass the scoped whitespace check. Light/dark samples and interactive
Arabic word help/composer were inspected in the browser. No commits created.

## Follow-up: rejected Arabic typography and message layout

The learner rejected the Naskh appearance in the native app: words appeared to
sit at inconsistent heights. The earlier browser-only assessment was insufficient.
Noto **Sans Arabic** now replaces Noto Naskh Arabic; the superseded Naskh assets
were removed. Updated provenance records 1,561 characters and 361,536 bytes for
Arabic, with unchanged cmap and retained GPOS/GSUB after conversion. The total
new font payload is now 9,516,464 bytes (9.08 MiB).

Saved word-help spans now remain inline when their annotations are hidden,
keeping source words and punctuation in one inline flow. Flex columns remain only
when annotations are shown underneath. The preview now compares plain and fully
annotated Arabic messages. Browser appearance checked; this does not establish
native WebKit behavior. Reading tests (35) and the production build passed.

## Follow-up: explicit vowel-mark clearance

The learner's next native screenshots still showed crowded marks after the
Noto Sans Arabic replacement. The stock-font change was not an accepted fix.

The active Arabic face is now **Skelly Arabic Reading**, a renamed OFL derivative
of the pinned Noto Sans Arabic. Common vowel-mark attachment anchors gain 0.18em
clearance (3.6 CSS pixels at 20px). Above/below marks move away from the base;
stacked mark attachments also gain clearance. No source characters are changed.
RTL reading/composer line height is 1.9 to provide room for these marks.

The TypeScript build tool uses fontTools to modify only the relevant GPOS anchor
coordinates and font names. Assertions compare cmap, glyph outlines, advance
widths, GSUB substitutions and variation tables after saving. Original font and
license remain beside the derivative and modification notice.

The preview compares the reported phrase and dotted-letter combinations at
20px, plus plain and annotated message layouts. Browser inspection shows more
clearance. This remains **unverified in the user's native webview**; it is not a
claim that arbitrary combinations or every Arabic-script language are supported.
Production build and style checks passed; font-table invariants passed.


## Final selection: stock Arabic font

The learner explicitly selected the preview’s **Stock font**, Noto Sans Arabic.
This supersedes the custom-clearance experiment above. The app now uses the same
unmodified Noto Sans Arabic asset and family as that sample. The derivative,
build tool and extra-clearance preview were removed. Diacritics remain in source
text and use the upstream font’s original positioning.

The running native app was inspected using temporary native-only font diagnostics,
including computed message styles and a fixed sample rendered by its own canvas.
The Arabic face range includes spaces and ASCII punctuation to keep native text
runs together. Temporary diagnostic code is removed after verification.

## Native-window investigation (supersedes earlier success claims)

A temporary Linux-only WebKit snapshot hook captured the actual native window,
not a browser preview or a canvas approximation. This revealed that font-load
success and a matching computed CSS family were insufficient verification.

Observed on host WebKitGTK 2.52.6:

- Continuous text and saved word-help spans both reproduce the crowded marks.
- The source message differs in vowel choices from the fixed preview sentence;
  comparisons must use exactly the same source string.
- Noto Sans Arabic 2.012 reproduces the issue as WOFF2, direct TTF and a static
  instance. Explicit mark/mkmk/kerning features and text-rendering modes did not
  correct it.
- Noto Sans Arabic 2.005, installed or bundled unchanged, changed appearance but
  did not resolve the collision on closer inspection. The attempted downgrade
  was reverted, not adopted.
- DejaVu Sans showed separated marks in the native comparison. A Linux-native
  compatibility font is proposed; the user has been asked to review that actual
  native comparison before replacing their expressly selected Noto font.

WebKit tracks related Arabic shaping failures, including Noto Sans Arabic and
Noto Naskh Arabic [@webkit_arabic_shaping255972]. This is corroborating context,
not proof of the exact internal defect in this application. The evidence supports
an engine/font compatibility issue; a specific GPOS failure remains a hypothesis.

## Upstream guidance review

The user requested established guidance rather than accepting the native font
substitution. That supersedes the pending DejaVu selection question. No DejaVu
fallback was adopted.

W3C requires font-specific diacritic combination and positioning information to
be applied by the renderer [@w3c_arabic_layout]. HarfBuzz applies `mark`, `mkmk`,
`ccmp` and required ligatures by default [@harfbuzz_opentype_features]. Noto's
usage guidance recommends script-specific fonts and comparing identical text
with a known working renderer when shaping differs [@noto_script_families2026].
This supports standard text/font shaping rather than custom mark offsets.

The official Noto Sans Arabic 2.013 release reports diacritic fixes, but linked
issues 265/266/268 concern specific combinations not present in the reported
sentence. An unmodified Regular OTF from that release was tested temporarily
in the actual native message; it still showed the crowding. The release was not
adopted as a claimed fix. The app remains on stock 2.012.

All temporary native snapshot hooks, direct WebKit dependency, font experiments,
comparison overlay and startup diagnostic code were removed. Actual native
captures remain in /tmp only. The root renderer defect is **not yet identified**;
the older WebKit issue is context, not a confirmed diagnosis. Browser preview,
font-load success and passing frontend checks must not be reported as proof of
correct native glyph positioning.

## Startup regression corrected

The three newly added bibliography entries used `review = {full}`, which is not
an accepted review state. This caused native configuration loading to refuse
startup. All three now use `reviewed`; accepted values are documented in
content/README.md and enforced by configuration/citations.rs. The previous
frontend build did not validate this native configuration and was insufficient.
`npm run languages:check` now passes disk/bundled content validation and all 30
configuration tests. Future bibliography edits need this native check before
reporting completion.

## Accepted native selection: Scheherazade New

This supersedes the preceding Noto selections and unresolved font-choice status.
The learner inspected the actual native application and approved Scheherazade
New. Version 4.500 is now bundled as original upstream WOFF2 files at weights
400, 500, 600 and 700, with its license and per-file provenance. Its simplified
Naskh design informed this trial [@sil_scheherazade_new2026]; acceptance rests on
native rendering, not browser preview or character coverage alone.

Arabic uses this face first, retaining the stock Noto Sans Arabic as a fallback
and explicitly labeled comparison reference. No custom mark offsets or modified
font tables remain. The language default scale is 1.8 to accommodate this face;
learner overrides remain effective. Diacritics remain independent of dialect.
Other script font selections are unchanged.

Temporary native snapshots, diagnostic startup hooks, direct WebKit dependency
and experimental TTFs were removed after inspection. This resolves the font
selection/readability issue for the inspected sample; it does not establish the
specific upstream cause of Noto's different native appearance.

Final checks after cleanup: production UI build, preview typecheck, 51-sheet
style validation and generated design-system check pass; 55 reading/language
UI tests and 30 native configuration tests pass. Disk content validation includes
the bibliography. The production build retains its bundle-size advisory.
An invalid CSS property in the concurrent admin stylesheet was corrected from
`var(--ink-on-fill)-space` to `white-space`, eliminating its parser warning.
No commit was created.
