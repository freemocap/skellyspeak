import { checkUiSource, missingCatalogMessages } from '../ui/tools/localization/source-check.ts'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { validateLocales } from '../ui/src/domain/localization/messages.ts'
import type { Dict } from '../ui/src/domain/localization/dict.ts'

const root = path.resolve(import.meta.dirname, '..')
const localeDir = path.join(root, 'ui/src/domain/localization/locales')
const locales: Record<string, Dict> = {}
const errors: string[] = []
for (const file of fs.readdirSync(localeDir).sort()) {
  if (!file.endsWith('.json')) throw new Error(`Unexpected locale file: ${file}. Use a JSON dictionary.`)
  const text = fs.readFileSync(path.join(localeDir, file), 'utf8')
  const source = ts.parseJsonText(file, text)
  function checkDuplicates(node: ts.Node) {
    if (ts.isObjectLiteralExpression(node)) {
      const seen = new Set<string>()
      for (const property of node.properties) {
        if (!ts.isPropertyAssignment(property)) continue
        const name = ts.isStringLiteral(property.name) ? property.name.text : property.name.getText(source)
        if (seen.has(name)) errors.push(`${file}: duplicate message/property ${name}`)
        seen.add(name)
      }
    }
    ts.forEachChild(node, checkDuplicates)
  }
  checkDuplicates(source)
  locales[file.slice(0, -5)] = JSON.parse(text) as Dict
}
validateLocales(locales)
// YAML and reference validation remains with the Rust content loader.
const keys = new Set(Object.keys(locales.english))
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'ui/src/generated/skill-catalogs/catalog.json'), 'utf8'))
for (const key of missingCatalogMessages(catalog, keys)) errors.push(`Skill catalog: missing message ${JSON.stringify(key)}`)
function scan(dir: string) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) { scan(file); continue }
    if (!/\.tsx?$/.test(file) || /\.(test|d)\.tsx?$/.test(file)) continue
    errors.push(...checkUiSource(path.relative(root, file), fs.readFileSync(file, 'utf8'), keys))
  }
}
scan(path.join(root, 'ui/src'))
if (errors.length) throw new Error(errors.join('\n'))
console.log(`${Object.keys(locales).length} interface locales, ${Object.keys(locales.english).length} UI messages per locale; IDs, keys, plurals, placeholders, catalog coverage and rendered UI text checked.`)
