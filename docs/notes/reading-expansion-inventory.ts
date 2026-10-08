import fs from 'node:fs'
import path from 'node:path'
import { parse } from 'yaml'

// Audit authored guide samples using the same default-locale word boundaries as savedGlossQuery.
const languages = ['english', 'spanish', 'arabic', 'french']
const inventory: Record<string, Record<string, { principal: Set<string>; inline: Set<string> }>> = {}
for (const language of languages) {
  inventory[language] = {}
  const root = `content/languages/${language}/skills`
  for (const file of fs.readdirSync(root, { recursive: true }).map(String).filter(f => /-explained-in-[^/\\]+\.yaml$/.test(f))) {
    const guide = parse(fs.readFileSync(path.join(root, file), 'utf8'))
    for (const [variety, disposition] of Object.entries(guide.varieties ?? {}) as [string, {disposition:string}][]) {
      if (disposition.disposition !== 'use_core') continue
      const target = inventory[language][variety] ??= {principal:new Set(), inline:new Set()}
      const overrides = guide.variety_sections?.[variety] ?? []
      const sections = (guide.sections ?? []).map((section: any) => overrides.find((s:any) => s.subskill_id === section.subskill_id) ?? section)
      const words = (text:string, dest:Set<string>) => { for (const word of new Intl.Segmenter(undefined, {granularity:'word'}).segment(text)) if (word.isWordLike) dest.add(word.segment) }
      for (const section of sections) {
        for (const example of section.examples ?? []) words(example.text, target.principal)
        const walk = (value:any) => {
          if (typeof value === 'string') { for (const match of value.matchAll(/`([^`]+)`/g)) words(match[1], target.inline) }
          else if (Array.isArray(value)) value.forEach(walk)
          else if (value && typeof value === 'object') Object.values(value).forEach(walk)
        }
        walk(section)
      }
    }
  }
}
const result = Object.fromEntries(Object.entries(inventory).map(([language,varieties]) => [language,Object.fromEntries(Object.entries(varieties).map(([variety,sets]) => [variety,{principal:[...sets.principal].sort(),inline:[...sets.inline].sort()}]))]))
console.log(JSON.stringify(result,null,2))
