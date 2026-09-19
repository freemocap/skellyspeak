import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

export interface MessageUsage { key: string; direct: string[]; references: string[] }

/** Conservative candidates, never automatic deletion. A textual reference does
 * not prove reachability; it protects metadata, native labels and proper names
 * that reach translators dynamically. Tests and archived sources do not count.
 */
export function auditMessages(keys: string[], files: { path: string; text: string }[]): MessageUsage[] {
  const usages = keys.map(key => ({ key, direct: [] as string[], references: [] as string[] }))
  const byKey = new Map(usages.map(usage => [usage.key, usage]))
  for (const file of files) {
    const typescript = /\.tsx?$/.test(file.path)
    const source = typescript ? ts.createSourceFile(file.path, file.text, ts.ScriptTarget.Latest, true) : undefined
    const literals = new Set<string>()
    function collect(value: unknown): void {
      if (typeof value === 'string') literals.add(value)
      else if (Array.isArray(value)) value.forEach(collect)
      else if (value && typeof value === 'object') Object.values(value).forEach(collect)
    }
    if (source) {
      function collectLiterals(node: ts.Node) {
        if (ts.isStringLiteralLike(node)) literals.add(node.text)
        ts.forEachChild(node, collectLiterals)
      }
      collectLiterals(source)
    } else if (file.path.endsWith('.json')) collect(JSON.parse(file.text))
    for (const usage of usages) {
      // Native/YAML references remain conservative textual evidence. Their
      // parsers and validation belong to Rust, not this UI audit.
      const referenced = source || file.path.endsWith('.json') ? literals.has(usage.key)
        : file.text.includes(usage.key) || file.text.includes(JSON.stringify(usage.key).slice(1, -1))
      if (referenced) usage.references.push(file.path)
    }
    if (!source) continue
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node)) {
        const name = node.expression.getText(source)
        if (['tr', 't', 'messageKey'].includes(name)) {
          const argument = node.arguments[name === 't' ? 1 : 0]
          if (argument && ts.isStringLiteralLike(argument)) {
            const usage = byKey.get(argument.text)
            if (usage && !usage.direct.includes(file.path)) usage.direct.push(file.path)
          }
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return usages
}

export function sourceFiles(root: string): { path: string; text: string }[] {
  const files: { path: string; text: string }[] = []
  function scan(directory: string) {
    for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
      const file = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        if (!['target', 'gen', 'node_modules', 'tests'].includes(entry.name) && !['ui/src/domain/localization/locales', 'ui/tools/localization'].includes(file.split(path.sep).join('/'))) scan(file)
      } else if (/\.(tsx?|rs|json|ya?ml)$/.test(file) && !/\.(test|d)\.tsx?$/.test(file)) {
        files.push({ path: file.split(path.sep).join('/'), text: fs.readFileSync(path.join(root, file), 'utf8') })
      }
    }
  }
  for (const directory of ['ui/src', 'ui/tools', 'native/src', 'content']) scan(directory)
  return files
}

if (import.meta.main) {
  const root = path.resolve(import.meta.dirname, '../../..')
  const dictionary = JSON.parse(fs.readFileSync(path.join(root, 'ui/src/domain/localization/locales/english.json'), 'utf8'))
  const usage = auditMessages(Object.keys(dictionary), sourceFiles(root))
  const direct = usage.filter(item => item.direct.length)
  const indirect = usage.filter(item => !item.direct.length && item.references.length)
  const candidates = usage.filter(item => !item.direct.length && !item.references.length)
  if (process.argv.includes('--json')) console.log(JSON.stringify({ total: usage.length, direct, indirect, candidates }, null, 2))
  else {
    console.log(`${usage.length} messages: ${direct.length} direct translation references; ${indirect.length} other source/data references; ${candidates.length} removal candidates.`)
    console.log('Other references are conservative evidence, not proof of runtime use. Review dynamic callers before deleting any candidate.')
    for (const item of candidates) console.log(JSON.stringify(item.key))
  }
  if (process.argv.includes('--check') && candidates.length) process.exitCode = 1
}
