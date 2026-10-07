import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { parse } from 'yaml'

type Section = { subskill_id: string; explanation: string; examples: {text:string;meaning:string;note:string}[] }
type Guide = { sections:Section[]; variety_sections?:Record<string,Section[]>; varieties:Record<string,unknown> }
const summary = []
for (const language of process.argv.slice(2)) {
  const base = `content/languages/${language}/skills`
  let files = 0, sections = 0, selectedSections = 0
  const changedExamples: unknown[] = []
  for (const group of readdirSync(base)) {
    const editions = readdirSync(`${base}/${group}`).filter(f=>f.includes('-explained-in-') && f.endsWith('.yaml'))
    const docs = editions.map(file=>({file,doc:parse(readFileSync(`${base}/${group}/${file}`,'utf8')) as Guide}))
    const source = docs.find(d=>d.file.endsWith('-english.yaml'))!
    for (const {file,doc} of docs) {
      files++; sections += doc.sections.length
      const path = `${base}/${group}/${file}`
      const prior: Guide = parse(execFileSync('git',['show',`HEAD:${path}`],{encoding:'utf8'}))
      const oldTexts = new Set([...prior.sections,...Object.values(prior.variety_sections??{}).flat()].flatMap(s=>s.examples.map(e=>e.text)))
      const newTexts = new Set([...doc.sections,...Object.values(doc.variety_sections??{}).flat()].flatMap(s=>s.examples.map(e=>e.text)))
      for (const text of oldTexts) if (!newTexts.has(text)) changedExamples.push({file,removed:text})
      for (const text of newTexts) if (!oldTexts.has(text)) changedExamples.push({file,added:text})
      for (const variety of Object.keys(doc.varieties)) {
        const chosen = doc.variety_sections?.[variety] ?? doc.sections
        const original = source.doc.variety_sections?.[variety] ?? source.doc.sections
        if (JSON.stringify(chosen.map(s=>s.examples.map(e=>e.text))) !== JSON.stringify(original.map(s=>s.examples.map(e=>e.text)))) throw Error(`Example edition mismatch ${file} ${variety}`)
        selectedSections += chosen.length
        for (const s of chosen) {
          const prose = [s.explanation,...s.examples.flatMap(e=>[e.meaning,e.note])].join('\n')
          if (/^\s*(?:#{1,6} |>)/m.test(prose)) throw Error(`Unsupported Markdown boundary: ${file}/${s.subskill_id}`)
          if ((prose.match(/`/g)?.length??0)%2) throw Error(`Unbalanced inline target marker: ${file}/${s.subskill_id}`)
        }
      }
    }
  }
  summary.push({language,files,sections,selectedSections,changedExamples})
}
console.log(JSON.stringify(summary,null,2))
