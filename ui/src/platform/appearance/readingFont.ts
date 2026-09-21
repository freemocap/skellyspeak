import { useEffect, useState } from 'react'

type Face = Pick<FontFace, 'family' | 'unicodeRange'>
const unquote = (name: string) => name.trim().replace(/^['"]|['"]$/g, '')

function covers(range: string, point: number): boolean {
  return range.split(',').some(part => {
    const bounds = part.trim().replace(/^U\+/i, '').split('-')
    const lower = parseInt(bounds[0].replaceAll('?', '0'), 16)
    const upper = parseInt((bounds[1] ?? bounds[0]).replaceAll('?', 'F'), 16)
    return point >= lower && point <= upper
  })
}

/** Resolve the configured script face, not a claim about platform glyph fallback. */
export function readingFontForText(stack: string, sample: string, faces: Iterable<Face>): string {
  const families = stack.split(',').map(unquote).filter(Boolean)
  const registered = Array.from(faces)
  const letters = Array.from(sample).filter(character => /\p{L}/u.test(character))
  const selected = letters.map(character => families.find(family => {
    const matching = registered.filter(face => unquote(face.family) === family)
    return matching.length === 0 || matching.some(face => covers(face.unicodeRange, character.codePointAt(0)!))
  })).filter((family): family is string => Boolean(family))
  return [...new Set(selected)].join(', ')
}

export function useReadingFont(sample: string, languageTag?: string | null): { family: string, stack: string } {
  const [font, setFont] = useState({ family: '', stack: '' })
  useEffect(() => {
    function update() {
      const probe = document.createElement('span')
      if (languageTag) probe.lang = languageTag
      probe.hidden = true
      document.body.append(probe)
      const stack = getComputedStyle(probe).getPropertyValue('--font-serif').trim()
      probe.remove()
      setFont({ stack, family: readingFontForText(stack, sample, document.fonts ?? []) })
    }
    update()
    document.fonts?.addEventListener('loadingdone', update)
    return () => document.fonts?.removeEventListener('loadingdone', update)
  }, [sample, languageTag])
  return font
}
