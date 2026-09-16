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
// YAML and reference validation is performed by the Rust content loader, never regex.
// Brand names, units and executable commands are intentionally not translated.
const literalTerms = new Set(['AI', 'XP', 'SKELLYSPEAK', 'SkellySpeak', 'npm run tauri dev'])
function scan(dir: string) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) { scan(file); continue }
    if (!/\.tsx?$/.test(file) || /\.(test|d)\.tsx?$/.test(file)) continue
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
    function requireKey(key: string, node: ts.Node) {
      if (!Object.hasOwn(locales.english, key)) errors.push(`${path.relative(root, file)}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: missing message ${JSON.stringify(key)}`)
    }
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node)) {
        const name = node.expression.getText(source)
        if (['tr', 't', 'messageKey'].includes(name)) {
          const arg = node.arguments[name === 't' ? 1 : 0]
          if (arg && ts.isStringLiteral(arg)) requireKey(arg.text, arg)
        }
      }
      if (ts.isJsxText(node)) {
        const value = node.text.trim()
        if (/[a-z]{2}/i.test(value) && !literalTerms.has(value)) errors.push(`${path.relative(root, file)}: untranslated JSX text ${JSON.stringify(value)}`)
      }
      if (ts.isJsxAttribute(node) && ['title', 'placeholder', 'aria-label', 'alt', 'label'].includes(node.name.getText(source)) && node.initializer && ts.isStringLiteral(node.initializer)) {
        const value = node.initializer.text
        if (/[a-z]{2}/i.test(value) && !literalTerms.has(value)) errors.push(`${path.relative(root, file)}: untranslated ${node.name.getText(source)} ${JSON.stringify(value)}`)
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
}
scan(path.join(root, 'ui/src'))
if (errors.length) throw new Error(errors.join('\n'))
console.log(`${Object.keys(locales).length} interface locales, ${Object.keys(locales.english).length} UI messages per locale; IDs, keys, plurals, placeholders and static UI text checked.`)
