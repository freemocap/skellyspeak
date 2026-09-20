# Arabic mark offset — 2026-09-20

## Accepted and implemented

The learner selected D in a temporary dialog in the actual native application:
raise upper and lower vowel marks by approximately 0.06 em. Final variants use
123 units at 2048 units/em for all four weights, preserving shaping tables and
base-letter outlines. 25 common harakat glyphs (including combined and alternate
forms) are shifted. Hamza, madda, letter dots and other signs are not globally
shifted. This is a targeted readability adjustment, not a general Arabic layout
rule. Other languages using different script faces are unchanged.

The OFL derivative is renamed Skelly Arabic Reading. Original fonts, copyright
and license are retained beside it; hashes and derivation are in sources.json.
It implements the learner-selected movement, superseding the earlier decision
to leave all outlines unmodified. Original GPOS/GSUB remain unchanged; translating
the outlines rather than altering attachment anchors avoids accumulating offsets
in mark stacks. No text splitting, spacing or dialect changes are involved.

Temporary native dialog, snapshot listener, direct WebKit dependency and trial
fonts were removed after selection.

## Reproduction

Run at repository root with fontTools 4.65.0 and Brotli installed. These are font
asset generation instructions, not runtime application code.

```python
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.transformPen import TransformPen
import re
for weight in [400,500,600,700]:
 source=Path(f'ui/public/fonts/scheherazade-new-{weight}.woff2')
 step=6
 f=TTFont(source); original=TTFont(source); gs=original.getGlyphSet()
 delta=round(f['head'].unitsPerEm*step/100)
 selected=[g for g in f.getGlyphOrder() if re.fullmatch(r'uni(?:064[B-F]|065[0-2])(?:(?:064[B-F]|065[0-2]|0670))*(?:\..+)?',g)]
 for g in selected:
  pen=TTGlyphPen(None)
  # Decompose original outlines, then translate; positioning anchors stay intact.
  from fontTools.pens.recordingPen import DecomposingRecordingPen
  recording=DecomposingRecordingPen(gs);gs[g].draw(recording)
  recording.replay(TransformPen(pen,(1,0,0,1,0,delta)))
  f['glyf'][g]=pen.glyph()
 family='Skelly Arabic Reading'
 for rec in f['name'].names:
  if rec.nameID in [1,3,4,6,16]:
   value=(family.replace(' ','') + '-' + str(weight)) if rec.nameID==6 else (family + ' ' + str(weight) if rec.nameID in [3,4] else family)
   rec.string=value.encode(rec.getEncoding())
 f.save(f'ui/public/fonts/skelly-arabic-reading-{weight}.woff2')
 print(step,delta,len(selected))

```
