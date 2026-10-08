import fs from 'node:fs'
const inventory = JSON.parse(fs.readFileSync('docs/notes/reading-expansion-inventory.json', 'utf8')).spanish
const tuples = JSON.parse(fs.readFileSync('docs/notes/reading-expansion/spanish-sample-tuples.json', 'utf8'))
const tupleMap = new Map(Object.entries(tuples).map(([word, glosses]) => [word.toLocaleLowerCase('es'), glosses]))
const extraCommon = JSON.parse(fs.readFileSync('docs/notes/reading-expansion/spanish-extra-common.json', 'utf8'))
for (const [word, glosses] of Object.entries(extraCommon)) tupleMap.set(word.toLocaleLowerCase('es'), glosses)
const draftText = fs.readFileSync('docs/notes/reading-expansion/spanish-common-entries.json', 'utf8').replace(/\\n\s*$/u, '')
const draft = JSON.parse(draftText)
const previous = new Map()
for (const entry of draft) {
  const key = `${entry.scope.variety}|${entry.text.toLocaleLowerCase('es')}`
  const item = previous.get(key) ?? {}
  item[entry.scope.explanation] = entry.gloss
  previous.set(key, item)
}
const references = [
  'https://en.wiktionary.org/wiki/Wiktionary:Frequency_lists/Spanish1000',
  'https://www.parallel-arabic.com/levantine/phrases/thank-you',
  'https://www.openarabic.org/common-arabic-phrases/',
  'https://en.wikibooks.org/wiki/Levantine_Arabic/Verbs',
]
const senseNotes = {
  cara: 'Feminine form of caro meaning expensive in the comparison example; cara can also mean face.',
  fue: 'Preterite third-person singular of ir (went) in the destination example; also a form of ser.',
  fui: 'Preterite first-person singular of ir (went) in the destination example; also a form of ser.',
  cenamos: 'First-person plural present or preterite; the narrative example uses the past meaning had dinner.',
  lo: 'In Lo siento, part of a conventional apology meaning I am sorry.',
  'mañana': 'Can mean morning or tomorrow; the intended sense depends on context.',
  que: 'Unaccented conjunction or relative pronoun; distinguish interrogative qué.',
  'qué': 'Interrogative form with an accent; distinguish conjunction que.',
  si: 'Unaccented conditional si means if; distinguish affirmative sí.',
  'sí': 'Accented affirmative sí means yes; distinguish conditional si.',
  ser: 'Infinitive used for identity and classification in these examples; contrast estar for state or location.',
  estar: 'Infinitive used for state or location in these examples; contrast ser for identity or classification.',
  tiempo: 'Can mean time or weather; the intended sense depends on context.',
  poder: 'Infinitive expressing ability or possibility; a permission reading depends on context.',
}
const entries = []
const missing = []
for (const [variety, data] of Object.entries(inventory)) {
  const sampleSurfaces = new Set([...data.principal, ...data.inline])
  const commonSurfaces = Object.keys(extraCommon).filter(word => !sampleSurfaces.has(word))
  for (const text of new Set([...sampleSurfaces, ...commonSurfaces])) {
    const key = text.toLocaleLowerCase('es')
    const values = tupleMap.get(key)
    const old = previous.get(`${variety}|${key}`) ?? previous.get(`spanish-spain|${key}`)
    const glosses = values ?? (old && [old.english, old.arabic, old.french])
    if (!glosses || glosses.length !== 3) { missing.push({ variety, text }); continue }
    const suffix = [...text].map(char => char.codePointAt(0).toString(16)).join('-')
    for (const [explanation, explanationVariety, slot] of [['english', 'english-united-states', 0], ['arabic', 'arabic-levantine', 1], ['french', 'french-france', 2]]) {
      entries.push({
        id: `spanish-${variety}-${suffix}-${explanation}`,
        scope: { language: 'spanish', variety, explanation, explanationVariety },
        text,
        gloss: glosses[slot].replace(/\s+\([^)]*\)/gu, ''),
        romanization: null,
        pronunciation: null,
        sense: senseNotes[key] ?? (sampleSurfaces.has(text)
          ? `Sample-context draft gloss for “${text}”; verify sense and inflection before import.`
          : `Common-word draft gloss for “${text}”; verify sense and variety before import.`),
        sources: references,
      })
    }
  }
}
fs.writeFileSync('docs/notes/reading-expansion/spanish-common-entries.json', `${JSON.stringify(entries, null, 2)}\n`)
fs.writeFileSync('docs/notes/reading-expansion/spanish-unresolved.json', `${JSON.stringify(missing, null, 2)}\n`)
console.log(JSON.stringify({ sourceSurfacesPerVariety: entries.length / 6, directedEntries: entries.length, unresolved: missing.length }))
