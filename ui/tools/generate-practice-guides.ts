/** Rebuild the preview fixture through the production Markdown composer. Run from repo root. */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
const catalog = JSON.parse(readFileSync('ui/src/generated/skill-catalogs/catalog.json', 'utf8')) as {id: string; kind: string}[]
const guides = ['spanish-spain', 'spanish-mexico'].map(id => ({
  id, name: id,
  skills: Object.fromEntries(catalog.filter(skill => skill.kind === 'skill').map(skill => [skill.id,
    execFileSync('cargo', ['run', '--quiet', '--manifest-path', 'native/Cargo.toml', '--bin', 'inspect-content', '--', '--skill-markdown', 'spanish', id, skill.id], { encoding: 'utf8' }),
  ])),
}))
writeFileSync('ui/tools/practice-guides.generated.json', JSON.stringify(guides, null, 2) + '\n')
