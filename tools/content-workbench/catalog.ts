import { schemaPreview } from './schema.ts'
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync } from 'node:fs'
import { isAbsolute, join, posix, relative, resolve } from 'node:path'
import { isMap, isScalar, isSeq, LineCounter, parseDocument, stringify } from 'yaml'

export interface Anchor { file: string; line: number; label: string; key: string }
export interface Link { from: Anchor; to: Anchor[]; kind: string }
export interface Entry {
  path: string; group: string; text: string; revision: string; editable: boolean
  schemaPreview?: {yaml: string; fields: {path: string; presence: string; type: string}[]; notes: string[]};
  value: unknown; errors: string[]; headings: Anchor[]
}
export interface Catalog { entries: Entry[]; links: Link[] }
export const LIMIT = 1024 * 1024
const roots = ['content']
export const revision = (text: string) => createHash('sha256').update(text).digest('hex')

export function allowed(path: string): boolean {
  return !path.split('/').some(part => !part || part === '.' || part === '..' || part.startsWith('.')) &&
    (path === 'references.bib' || roots.some(root => path.startsWith(`${root}/`))) &&
    /\.(yaml|yml|json|md|bib)$/.test(path)
}
export function safePath(root: string, path: string): string {
  if (!allowed(path)) throw Error('File is outside the authoring collection.')
  let current = root
  for (const part of path.split('/')) {
    current = join(current, part)
    if (lstatSync(current).isSymbolicLink()) throw Error('Symbolic links are not editable or indexed.')
  }
  if (isAbsolute(relative(realpathSync(root), realpathSync(current))) || relative(realpathSync(root), realpathSync(current)).startsWith('..')) throw Error('File escaped repository.')
  if (!lstatSync(current).isFile() || lstatSync(current).size > LIMIT) throw Error('Expected a file of at most 1 MiB.')
  return current
}
export function inspect(path: string, text: string): { value: unknown; errors: string[]; scalars: Anchor[] } {
  const scalars: Anchor[] = []
  if (/\.ya?ml$/.test(path)) {
    const lines = new LineCounter()
    const doc = parseDocument(text, { lineCounter: lines, uniqueKeys: true })
    const errors = [...doc.errors, ...doc.warnings].map(error => error.message)
    let value: unknown = null
    if (!errors.length) {
      try { value = doc.toJS({ maxAliasCount: 100 }); JSON.stringify(value) } catch (error) { errors.push(String(error)) }
    }
    function walk(node: unknown, keys: string[]) {
      if (isMap(node)) for (const pair of node.items) {
        const key = String(isScalar(pair.key) ? pair.key.value : '')
        const owner = keys.join('.')
        const keyRole = owner === 'varieties' ? '$variety'
          : /(^|\.)(orthographies|romanization_schemes)$/.test(owner) ? '$definition' : undefined
        if (isScalar(pair.key) && keyRole) {
          scalars.push({file: path, key: `${owner}.${keyRole}`, label: key, line: lines.linePos(pair.key.range?.[0] ?? 0).line})
        }
        walk(pair.value, [...keys, key])
      }
      else if (isSeq(node)) node.items.forEach((item, index) => walk(item, [...keys, String(index)]))
      else if (isScalar(node) && typeof node.value === 'string') scalars.push({ file: path, key: keys.join('.'), label: node.value, line: lines.linePos(node.range?.[0] ?? 0).line })
    }
    if (!errors.length) walk(doc.contents, [])
    return { value, errors, scalars }
  }
  if (path.endsWith('.json')) {
    try { return { value: JSON.parse(text), errors: [], scalars } }
    catch (error) { return { value: null, errors: [String(error)], scalars } }
  }
  return { value: null, errors: [], scalars }
}
export function readEntry(root: string, path: string): Entry {
  const text = readFileSync(safePath(root, path), 'utf8')
  const { value, errors, scalars } = inspect(path, text)
  const headings = scalars.filter(s => /(^|\.)(id|title|name|label)$/.test(s.key))
  text.split('\n').forEach((line, index) => {
    const heading = /^(#{1,6})\s+(.+)$/.exec(line)
    const bib = /^@\w+\{([^,]+),/.exec(line)
    if (heading || bib) headings.push({ file: path, line: index + 1, label: heading?.[2] ?? bib![1], key: bib ? 'citation' : 'heading' })
  })
  const preview = path.startsWith('content/rust-schemas/') && value && !errors.length ? schemaPreview(value) : undefined
  return { schemaPreview: preview ? {yaml: stringify(preview.sample), fields: preview.fields, notes: preview.notes} : undefined, path, text, value, errors, headings, revision: revision(text),
    editable: !path.startsWith('content/rust-schemas/') && path !== 'references.bib',
    group: path.startsWith('content/languages/') ? 'Languages' : path.startsWith('content/prompts/') ? 'Prompts' : path.startsWith('content/rust-schemas/') ? 'Generated schemas' : path === 'references.bib' ? 'References' : 'Content policies and skill definitions' }
}
export function catalog(root: string): Catalog {
  const paths: string[] = []
  function walk(path: string) {
    if (!existsSync(join(root, path)) || lstatSync(join(root, path)).isSymbolicLink()) return
    if (lstatSync(join(root, path)).isDirectory()) {
      for (const name of readdirSync(join(root, path)).sort()) if (!name.startsWith('.')) walk(`${path}/${name}`)
    } else if (allowed(path)) paths.push(path)
  }
  roots.forEach(walk); walk('references.bib')
  const entries = paths.map(path => readEntry(root, path))
  const definitions = new Map<string, Anchor[]>()
  for (const entry of entries) for (const heading of entry.headings) {
    if (!entry.path.includes('/__') && !entry.path.startsWith('content/rust-schemas/') && (heading.key.endsWith('.id') || heading.key === 'id' || heading.key === 'citation')) {
      definitions.set(heading.label, [...(definitions.get(heading.label) ?? []), heading])
    }
  }
  const links: Link[] = []
  const declared = /(^|\.)(sources|traits|script|family|language|variety|\$variety|skill_id|subskill_id|explanation_language|neighbors)(\.\d+)?$/
  for (const entry of entries) {
    for (const scalar of inspect(entry.path, entry.text).scalars) {
      if (scalar.key.endsWith('.id') || scalar.key === 'id' || scalar.key.endsWith('.$definition')) continue
      let candidates = definitions.get(scalar.label) ?? []
      const role = scalar.key.replace(/\.\d+$/, '').split('.').at(-1)
      if (role === 'sources') candidates = candidates.filter(c => c.file === 'references.bib')
      if (role === '$variety') {
        const languageOwner = entry.path.split('/').slice(0, 3).join('/')
        candidates = candidates.filter(c => c.file.startsWith(`${languageOwner}/`) && c.file.endsWith('-language.yaml') && c.key.startsWith('varieties.'))
      }
      const namespaces: Record<string, string> = {script: 'scripts.', family: 'families.', traits: 'traits.'}
      if (role && namespaces[role]) candidates = candidates.filter(c => c.file === 'content/language-foundations/language-foundations.yaml' && c.key.startsWith(namespaces[role]))
      if (role === 'skill_id') candidates = candidates.filter(c => c.file.startsWith('content/skills/') && c.file.endsWith('-definition.yaml') && c.key === 'id')
      if (role === 'subskill_id' || role === 'neighbors') candidates = candidates.filter(c => c.file.startsWith('content/skills/') && c.file.endsWith('-subskills.yaml'))
      if (role === 'shared_explanation') {
        const target = entries.find(e => e.path === `content/${scalar.label}`)
        links.push({from: scalar, to: target ? [{file: target.path, line: 1, label: target.path, key: 'file'}] : [], kind: 'Shared explanation'})
      }
      if (role === 'language' || role === 'explanation_language') candidates = candidates.filter(c => c.file.startsWith('content/languages/') && c.key === 'identity.id')
      if (role === 'variety') candidates = candidates.filter(c => c.file.startsWith('content/languages/') && c.key.startsWith('varieties.'))
      if (declared.test(scalar.key) || candidates.length) links.push({ from: scalar, to: candidates, kind: declared.test(scalar.key) ? 'Declared reference' : 'Identifier mention' })
      // Local/shared references point at named definitions, scoped to their actual owner.
      if (/\.(local|shared)$/.test(scalar.key)) {
        const target = scalar.key.endsWith('.local') ? entry : entries.find(e => e.path === 'content/language-foundations/language-foundations.yaml')
        const namespace = scalar.key.includes('orthograph') ? 'orthographies' : 'romanization_schemes'
        const match = target ? inspect(target.path, target.text).scalars.find(s => s.key.endsWith(`${namespace}.$definition`) && s.label === scalar.label) : undefined
        links.push({ from: scalar, kind: `${namespace} definition`, to: match ? [match] : [] })
      }
    }
    entry.text.split('\n').forEach((line, index) => {
      for (const cite of line.matchAll(/\[@([\w-]+)\]/g)) links.push({ from: {file: entry.path, line: index + 1, label: cite[1], key: 'citation'}, to: definitions.get(cite[1]) ?? [], kind: 'Citation' })
      const fileTargets = [...line.matchAll(/\]\(([^)]+)\)/g)].map(m => m[1]).concat([...line.matchAll(/\$schema=(\S+)/g)].map(m => m[1]))
      for (const raw of fileTargets) {
        if (/^[a-z]+:/i.test(raw) || raw.startsWith('#')) continue
        const path = posix.normalize(posix.join(posix.dirname(entry.path), raw.split('#')[0]))
        if (!allowed(path)) continue
        const found = entries.find(e => e.path === path)
        links.push({from: {file: entry.path, line: index + 1, label: raw, key: 'file'}, to: found ? [{file: path, line: 1, label: path, key: 'file'}] : [], kind: 'File link'})
      }
    })
  }
  return { entries, links }
}
export const repository = resolve(import.meta.dirname, '../..')
