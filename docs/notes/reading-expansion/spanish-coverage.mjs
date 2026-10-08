import fs from 'node:fs'
const inventory = JSON.parse(fs.readFileSync('docs/notes/reading-expansion-inventory.json', 'utf8')).spanish
const entries = JSON.parse(fs.readFileSync('docs/notes/reading-expansion/spanish-common-entries.json', 'utf8'))
const coverage = {}
for (const [variety, groups] of Object.entries(inventory)) {
  const surfaces = [...new Set([...groups.principal, ...groups.inline])].sort((a, b) => a.localeCompare(b, 'es'))
  const provided = new Set(entries.filter(entry => entry.scope.language === 'spanish' && entry.scope.variety === variety).map(entry => entry.text))
  coverage[variety] = {
    principalSurfaceCount: groups.principal.length,
    inlineSurfaceCount: groups.inline.length,
    uniqueSurfaceCount: surfaces.length,
    exactCoveredCount: surfaces.filter(surface => provided.has(surface)).length,
    exactUncoveredCount: surfaces.filter(surface => !provided.has(surface)).length,
    forms: surfaces.map(text => ({ text, status: provided.has(text) ? 'draft-present' : 'missing' })),
  }
}
fs.writeFileSync('docs/notes/reading-expansion/spanish-sample-coverage.json', `${JSON.stringify(coverage, null, 2)}\n`)
console.log(JSON.stringify(Object.fromEntries(Object.entries(coverage).map(([variety, data]) => [variety, { unique: data.uniqueSurfaceCount, covered: data.exactCoveredCount, missing: data.exactUncoveredCount }]))))
