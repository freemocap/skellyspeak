# Bundled typography

IBM Plex Sans (400/500/600/700), IBM Plex Mono (400/500/600), and Newsreader
(400/500) are served locally. No font request leaves the running application.
Downloaded from the Google Fonts CSS API on 2026-09-14; source font URLs are
recorded in the upstream families at https://github.com/google/fonts/tree/main/ofl.
Each family’s SIL Open Font License and copyright notice is included alongside
its files. Script coverage falls back to the system when a font lacks a glyph.

## Script coverage (2026-09-20)

The application bundles complete script fonts without glyph subsetting.
Scheherazade New 4.500 uses the original SIL release WOFF2 files; the Noto
variable fonts are converted losslessly to WOFF2. They are local assets, not a Google Fonts
runtime dependency. `sources.json` records the pinned upstream revision, source
and output SHA-256 hashes, conversion tool, character counts and license files.

| Text | Font | Weight range |
| --- | --- | --- |
| Arabic script | Scheherazade New 4.500 | 400/500/600/700 |
| Arabic fallback and comparison reference | Noto Sans Arabic | 100–900 |
| Devanagari (currently Hindi) | Noto Sans Devanagari | 100–900 |
| Malayalam | Noto Sans Malayalam | 100–900 |
| Simplified Chinese (currently Mandarin) | Noto Sans SC | 100–900 |
| Reading aids and broad Latin/Greek/Cyrillic fallback | Noto Sans | 100–900 |

Font declarations and stacks have one owner:
`ui/src/styles/foundations/tokens.css`. `--font-scripts` lists range-restricted
script faces **before** the Latin families in each role. CSS `unicode-range`
selects the correct script even inside mixed-language text and prevents script
fonts from taking over Latin letters. It does not add glyphs the font lacks.
The existing Newsreader / IBM Plex faces still own ordinary Latin reading / UI /
code text. Noto Sans supplies missing extended letters; romanization and
pronunciation use `--font-reading-aid` so their diacritics share one font.
Non-Latin text inside a code block is not guaranteed to be monospaced.

Font choice is presentation policy, independent of language `font_scale`, learner
reading size and spacing. Arabic uses the unmodified upstream font, including its original diacritic positioning.
RTL reading line height provides room for vowel marks. Fonts retain their shaping tables; source text and
whole-word shaping are unchanged. Missing characters ultimately use device
fallback. That is a safety net, not a claim of verified support.

### Adding languages

1. Reuse an existing script default when appropriate. A new Latin language need
   not duplicate a font definition. Check its alphabet, combining sequences and
   reading-aid characters against the actual bundled files.
2. For a new script, bundle a reviewed font plus license and provenance; add its
   range-restricted face to the shared stack. Browsers load used faces on demand.
3. For languages/varieties needing a different font within the same script, use
   an explicitly scoped language font stack at that text's BCP-47 `lang` boundary.
   Add the boundary at the surface that knows the text's language, not by assigning
   the selected target language to every shared text component: explanations and
   mixed-language quotes have independent languages. No per-language font picker
   or YAML font field is implemented by this change.
4. Han defaults here are **Simplified Chinese only**. Before adding Traditional
   Chinese, Japanese or Korean, add and verify the appropriate regional fonts and
   language boundaries. Likewise, Arabic-script coverage alone does not establish
   suitable typography for Urdu or other languages.
5. Add representative samples to `/tools/fonts-preview.html`, including stacked
   marks, conjunctions, mixed scripts, bold text, word help and narrow layouts.
   Test native webviews as well as the browser; glyph coverage alone cannot prove
   linguistic correctness or legibility.

New WOFF2 assets total 10,083,244 bytes (9.62 MiB); Simplified Chinese accounts for
7,782,184 bytes. All glyphs are retained to avoid restricting arbitrary learner
text to a sample-derived subset. Revisit optional offline font packs if the
supported script set becomes large; automatic remote font downloads are not
implemented.

Inspect `/tools/fonts-preview.html` through `npm run dev` for the before/after
comparison using production reading components. The previous-font column uses
this device's fallback; it does not reproduce every operating system's old font.
