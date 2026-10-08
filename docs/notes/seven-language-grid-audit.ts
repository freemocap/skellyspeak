import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { parse } from 'yaml'

// Authored coverage only: generated runtime translations do not fill a cell.
const languages = ['english', 'spanish', 'french', 'arabic', 'mandarin', 'cantonese', 'portuguese']
type Example = { text: string; meaning: string; note: string }
type Section = { subskill_id: string; explanation: string; examples: Example[] }
type Guide = { revision: string; language: string; explanation_language: string; shared_explanation: string; sections: Section[]; variety_sections?: Record<string, Section[]>; varieties: Record<string, unknown> }
const read = (path: string) => parse(readFileSync(path, 'utf8'))
const fragments = (text: string) => [...text.matchAll(/`([^`]+)`/g)].map(m => m[1]).sort()
const missing: string[] = []
let files = 0, sections = 0
const matrix: Record<string, Record<string, string>> = {}
for (const target of languages) {
  matrix[target] = {}
  const base = `content/languages/${target}/skills`
  const groups = readdirSync(base).filter(group => existsSync(`${base}/${group}/${target}-${group}-explained-in-english.yaml`))
  assert.equal(groups.length, 8, `${target}: expected eight groups`)
  for (const explanation of languages) {
    let count = 0
    for (const group of groups) {
      const path = `${base}/${group}/${target}-${group}-explained-in-${explanation}.yaml`
      if (!existsSync(path)) { missing.push(path); continue }
      const doc = read(path) as Guide
      const source = read(`${base}/${group}/${target}-${group}-explained-in-english.yaml`) as Guide
      assert.equal(doc.language, target, path)
      assert.equal(doc.explanation_language, explanation, path)
      const shared = read(`content/${doc.shared_explanation}`)
      assert.equal(shared.explanation_language, explanation, path)
      assert.deepEqual(Object.keys(doc.varieties).sort(), Object.keys(source.varieties).sort(), path)
      assert.deepEqual(Object.keys(doc.variety_sections ?? {}).sort(), Object.keys(source.variety_sections ?? {}).sort(), path)
      const batches = [doc.sections, ...Object.values(doc.variety_sections ?? {})]
      const originals = [source.sections, ...Object.keys(doc.variety_sections ?? {}).map(v => source.variety_sections![v])]
      const newEdition = !['english', 'cantonese'].includes(explanation) && !(target === 'spanish' && explanation === 'spanish')
      batches.forEach((batch, bi) => {
        assert.equal(batch.length, originals[bi].length, path)
        batch.forEach((section, si) => {
          const original = originals[bi][si]
          assert.equal(section.subskill_id, original.subskill_id, path)
          assert.deepEqual(section.examples.map(e => e.text), original.examples.map(e => e.text), path)
          const prose = [section.explanation, ...section.examples.flatMap(e => [e.meaning, e.note])]
          const english = [original.explanation, ...original.examples.flatMap(e => [e.meaning, e.note])]
          prose.forEach((field, fi) => {
            const location = `${path}/${bi}/${section.subskill_id}/${fi}`
            assert.ok(field.trim(), location)
            assert.equal((field.match(/`/g)?.length ?? 0) % 2, 0, location)
            assert.ok(!/^\s*(?:#{1,6} |>)/m.test(field), `Unexpected Markdown boundary: ${location}`)
            if (explanation !== 'english') assert.notEqual(field, english[fi], `Untranslated prose: ${location}`)
            if (newEdition) {
              assert.deepEqual(fragments(field), fragments(english[fi]), `Target fragment changed: ${location}`)
            }
          })
          sections++
        })
      })
      const reviews = (value: unknown): void => {
        if (!value || typeof value !== 'object') return
        for (const [key, child] of Object.entries(value)) {
          if (key === 'review') {
            assert.ok(child && typeof child === 'object' && 'revision' in child, path)
            assert.equal(child.revision, doc.revision, path)
          }
          else reviews(child)
        }
      }
      reviews(doc)
      files++; count++
    }
    matrix[target][explanation] = `${count}/8`
  }
}
console.table(matrix)
console.log(JSON.stringify({ files, sections, missing: missing.length }))
if (!process.argv.includes('--partial')) assert.equal(missing.length, 0, `Missing authored guides:\n${missing.join('\n')}`)
