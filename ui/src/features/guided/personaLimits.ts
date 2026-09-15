import { messageKey, t } from '../../domain/language/i18n'
import { PERSONA_LIMITS } from '../../generated/contracts'
import type { PersonaDetails } from '../../generated/contracts'

type Translate = (key: string, vars?: Record<string, string | number>) => string
const english: Translate = (key, vars) => t('en', key, vars)

/// The limits come from Rust, so the form cannot drift from the store. The
/// wording here matches the messages persona::validate returns, because a field
/// that fails on blur and a create that fails on the wire should read the same.

// The same explicit sequence grammar is used by native/src/emoji.rs and
// checked against test-fixtures/emoji.json at both boundaries.
const PRESENTATION = /^\p{Emoji_Presentation}$/u
const PICTOGRAPHIC = /^\p{Extended_Pictographic}$/u
const MODIFIER_BASE = /^\p{Emoji_Modifier_Base}$/u
const MODIFIER = /^\p{Emoji_Modifier}$/u
const REGIONAL = /^\p{Regional_Indicator}$/u

export function isEmoji(value: string): boolean {
  if (/^[\p{Regional_Indicator}]{2}$/u.test(value)) return true
  if (/^[0-9#*]\uFE0F?\u20E3$/u.test(value)) return true
  if (/^🏴[\u{E0061}-\u{E007A}]{2,}\u{E007F}$/u.test(value)) return true
  return value.split('\u200D').every(component => {
    const points = Array.from(component)
    const base = points.shift()
    if (!base || REGIONAL.test(base) || MODIFIER.test(base)) return false
    const selector = points[0] === '\uFE0F'
    if (selector) points.shift()
    const modifier = points.length > 0 && MODIFIER.test(points[0])
    if (modifier) points.shift()
    return points.length === 0
      && (!modifier || MODIFIER_BASE.test(base))
      && (PRESENTATION.test(base) || (PICTOGRAPHIC.test(base) && (selector || modifier)))
  })
}

type ListField = 'interests' | 'opinions' | 'interestingFacts' | 'favoriteBooks' | 'favoriteMovies' | 'quirks'

/// The authored lists, with the label Rust uses in its own messages.
export const PERSONA_LISTS: { key: ListField; label: string; hint: string; max: number }[] = [
  { key: 'interests', label: messageKey('Interests'), hint: messageKey('One per line'), max: PERSONA_LIMITS.interestsMax },
  { key: 'opinions', label: messageKey('Opinions'), hint: messageKey('One per line. A stance, not a trait'), max: PERSONA_LIMITS.opinionsMax },
  { key: 'interestingFacts', label: messageKey('Interesting facts'), hint: messageKey('One per line'), max: PERSONA_LIMITS.factsMax },
  { key: 'favoriteBooks', label: messageKey('Favorite books'), hint: messageKey('Title — Author'), max: PERSONA_LIMITS.booksMax },
  { key: 'favoriteMovies', label: messageKey('Favorite movies'), hint: messageKey('Title (Year)'), max: PERSONA_LIMITS.moviesMax },
  { key: 'quirks', label: messageKey('Quirks'), hint: messageKey('One per line, at most {max}'), max: PERSONA_LIMITS.quirksMax },
]

/// Lists are edited as Markdown bullets, one item per line.
export function itemsToLines(items: string[]): string {
  return items.map(item => `- ${item}`).join('\n')
}

/// Each line is one item, with or without a leading Markdown bullet (`-`, `*` or
/// `•`). Blank lines and exact repeats are dropped; order is the learner's.
export function linesToItems(value: string): string[] {
  const seen = new Set<string>()
  const items: string[] = []
  for (const line of value.split('\n')) {
    const item = line.trim().replace(/^[-*•]\s*/, '').trim()
    if (!item || seen.has(item)) continue
    seen.add(item)
    items.push(item)
  }
  return items
}

function listObjection(values: string[], label: string, max: number, tr: Translate): string | null {
  if (values.length > max) return tr('{label} allows at most {max} entries.', { label: tr(label), max })
  if (values.some(value => !value.trim())) return tr('{label} entries cannot be empty.', { label: tr(label) })
  if (values.some(value => value.length > PERSONA_LIMITS.itemMax)) return tr('{label} entries must be at most {max} characters.', { label: tr(label), max: PERSONA_LIMITS.itemMax })
  if (new Set(values).size !== values.length) return tr('{label} entries must be distinct.', { label: tr(label) })
  return null
}

/// Why these details cannot be saved, in the store's own words, or null when they
/// can. Mirrors persona::validate; Rust remains the authority.
/// `romanized` says whether the persona's language has a romanization system, in
/// which case the name must also be given in Latin letters.
export function personaObjection(details: PersonaDetails, romanized: boolean, tr: Translate = english): string | null {
  if (!details.name.trim() || details.name.length > PERSONA_LIMITS.nameMax) return tr('Name must be nonempty and be at most {max} characters.', { max: PERSONA_LIMITS.nameMax })
  if (romanized && (!details.romanizedName?.trim() || details.romanizedName.length > PERSONA_LIMITS.nameMax)) return tr('Romanized name must be nonempty and be at most {max} characters.', { max: PERSONA_LIMITS.nameMax })
  if (!romanized && details.romanizedName !== null) return tr('Romanized name is only used for languages written in a non-Latin script.')
  if (details.age !== null && (!Number.isInteger(details.age) || details.age < PERSONA_LIMITS.ageMin || details.age > PERSONA_LIMITS.ageMax)) {
    return tr('Age must be blank or a whole number between {min} and {max}.', { min: PERSONA_LIMITS.ageMin, max: PERSONA_LIMITS.ageMax })
  }
  const texts: [string, string, number][] = [
    [details.location, 'Location', PERSONA_LIMITS.locationMax],
    [details.occupation, 'Occupation', PERSONA_LIMITS.occupationMax],
    [details.background, 'Background', PERSONA_LIMITS.backgroundMax],
    [details.currentSituation, 'Current situation', PERSONA_LIMITS.currentSituationMax],
    [details.manner, 'Manner', PERSONA_LIMITS.mannerMax],
  ]
  for (const [value, label, max] of texts) {
    if (value.length > max) return tr('{label} must be at most {max} characters.', { label: tr(label), max })
  }
  for (const { key, label, max } of PERSONA_LISTS) {
    const objection = listObjection(details[key], label, max, tr)
    if (objection) return objection
  }
  if (details.vibe.length < PERSONA_LIMITS.vibeMin || details.vibe.length > PERSONA_LIMITS.vibeMax) {
    return tr('Vibe needs between {min} and {max} emoji.', { min: PERSONA_LIMITS.vibeMin, max: PERSONA_LIMITS.vibeMax })
  }
  for (const symbol of details.vibe) {
    if (!isEmoji(symbol)) return tr('Each Vibe entry must be one emoji. {symbol} is not an emoji.', { symbol })
  }
  if (new Set(details.vibe).size !== details.vibe.length) return tr('Vibe symbols must be distinct.')
  return null
}

/// How a persona is named everywhere it appears: its name, then its name in Latin
/// letters when it has one — "小林 (Xiǎo Lín)".
export function personaName(details: Pick<PersonaDetails, 'name' | 'romanizedName'>): string {
  return details.romanizedName ? `${details.name} (${details.romanizedName})` : details.name
}

/// A blank persona for the create form: every field present, nothing authored.
export function blankPersona(romanized: boolean): PersonaDetails {
  return {
    name: '',
    romanizedName: romanized ? '' : null,
    age: null,
    location: '',
    occupation: '',
    background: '',
    currentSituation: '',
    interests: [],
    opinions: [],
    interestingFacts: [],
    favoriteBooks: [],
    favoriteMovies: [],
    manner: '',
    quirks: [],
    vibe: [],
  }
}
