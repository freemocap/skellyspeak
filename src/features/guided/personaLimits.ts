import { PERSONA_LIMITS } from '../../contracts'
import type { PersonaDetails } from '../../contracts'

/// The limits come from Rust, so the form cannot drift from the store. The
/// wording here matches the messages persona::validate returns, because a field
/// that fails on blur and a create that fails on the wire should read the same.

/// One authored symbol. Rust is authoritative; this stops an obviously wrong
/// entry before the learner waits for a round trip.
const EMOJI = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:\uFE0F|\u20E3)?(?:\u200D(?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:\uFE0F|\u20E3)?)*$/u

export function isEmoji(value: string): boolean {
  return EMOJI.test(value)
}

type ListField = 'interests' | 'opinions' | 'interestingFacts' | 'favoriteBooks' | 'favoriteMovies' | 'quirks'

/// The authored lists, with the label Rust uses in its own messages.
export const PERSONA_LISTS: { key: ListField; label: string; hint: string; max: number }[] = [
  { key: 'interests', label: 'Interests', hint: 'One per line', max: PERSONA_LIMITS.interestsMax },
  { key: 'opinions', label: 'Opinions', hint: 'One per line. A stance, not a trait', max: PERSONA_LIMITS.opinionsMax },
  { key: 'interestingFacts', label: 'Interesting facts', hint: 'One per line', max: PERSONA_LIMITS.factsMax },
  { key: 'favoriteBooks', label: 'Favorite books', hint: 'Title — Author', max: PERSONA_LIMITS.booksMax },
  { key: 'favoriteMovies', label: 'Favorite movies', hint: 'Title (Year)', max: PERSONA_LIMITS.moviesMax },
  { key: 'quirks', label: 'Quirks', hint: `One per line, at most ${PERSONA_LIMITS.quirksMax}`, max: PERSONA_LIMITS.quirksMax },
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

export function sameItems(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index])
}

function listObjection(values: string[], label: string, max: number): string | null {
  if (values.length > max) return label + ' allows at most ' + max + ' entries.'
  if (values.some(value => !value.trim())) return label + ' entries cannot be empty.'
  if (values.some(value => value.length > PERSONA_LIMITS.itemMax)) return label + ' entries must be at most ' + PERSONA_LIMITS.itemMax + ' characters.'
  if (new Set(values).size !== values.length) return label + ' entries must be distinct.'
  return null
}

/// Why these details cannot be saved, in the store's own words, or null when they
/// can. Mirrors persona::validate; Rust remains the authority.
/// `romanized` says whether the persona's language has a romanization system, in
/// which case the name must also be given in Latin letters.
export function personaObjection(details: PersonaDetails, romanized: boolean): string | null {
  if (!details.name.trim() || details.name.length > PERSONA_LIMITS.nameMax) return 'Name must be nonempty and be at most ' + PERSONA_LIMITS.nameMax + ' characters.'
  if (romanized && (!details.romanizedName?.trim() || details.romanizedName.length > PERSONA_LIMITS.nameMax)) return 'Romanized name must be nonempty and be at most ' + PERSONA_LIMITS.nameMax + ' characters.'
  if (!romanized && details.romanizedName !== null) return 'Romanized name is only used for languages written in a non-Latin script.'
  if (details.age !== null && (!Number.isInteger(details.age) || details.age < PERSONA_LIMITS.ageMin || details.age > PERSONA_LIMITS.ageMax)) {
    return 'Age must be blank or a whole number between ' + PERSONA_LIMITS.ageMin + ' and ' + PERSONA_LIMITS.ageMax + '.'
  }
  const texts: [string, string, number][] = [
    [details.location, 'Location', PERSONA_LIMITS.locationMax],
    [details.occupation, 'Occupation', PERSONA_LIMITS.occupationMax],
    [details.background, 'Background', PERSONA_LIMITS.backgroundMax],
    [details.currentSituation, 'Current situation', PERSONA_LIMITS.currentSituationMax],
    [details.manner, 'Manner', PERSONA_LIMITS.mannerMax],
  ]
  for (const [value, label, max] of texts) {
    if (value.length > max) return label + ' must be at most ' + max + ' characters.'
  }
  for (const { key, label, max } of PERSONA_LISTS) {
    const objection = listObjection(details[key], label, max)
    if (objection) return objection
  }
  if (details.vibe.length < PERSONA_LIMITS.vibeMin || details.vibe.length > PERSONA_LIMITS.vibeMax) {
    return 'Vibe needs between ' + PERSONA_LIMITS.vibeMin + ' and ' + PERSONA_LIMITS.vibeMax + ' emoji.'
  }
  for (const symbol of details.vibe) {
    if (!isEmoji(symbol)) return 'Each Vibe entry must be one emoji. ' + symbol + ' is not an emoji.'
  }
  if (new Set(details.vibe).size !== details.vibe.length) return 'Vibe symbols must be distinct.'
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
