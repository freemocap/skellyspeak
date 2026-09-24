import { setupLayout } from './layout.js'
import { renderTree, expandTree, renderFileTree } from './tree.js'
import type { Anchor, Catalog, Entry, Link } from './catalog.ts'
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T
const editor = el<HTMLTextAreaElement>('editor')
let data: Catalog = {entries: [], links: []}
let current: Entry | undefined
let draft = ''
let editing = false
let treeMode = false
let busy = false
const dirty = () => Boolean(current && draft !== current.text)
function node(tag: string, text?: string, className?: string) {
  const n = document.createElement(tag)
  if (text !== undefined) n.textContent = text
  if (className) n.className = className
  return n
}
function button(label: string, action: () => void, className = '') {
  const b = node('button', label, className) as HTMLButtonElement
  b.onclick = action; return b
}
function status(text: string) { el('status').textContent = text }
function controls() {
  el<HTMLButtonElement>('save').disabled = !dirty() || busy
  el<HTMLButtonElement>('discard').disabled = !dirty() || busy
  el<HTMLButtonElement>('edit').disabled = !current || busy
  el('edit').textContent = current?.editable ? 'Edit source' : 'View source'
  editor.readOnly = !current?.editable
  el<HTMLButtonElement>('refresh').disabled = busy
  editor.disabled = busy
  el('dirty').textContent = dirty() ? 'Unsaved changes' : current?.editable ? 'Saved source' : 'Read-only'
  el('read').setAttribute('aria-pressed', String(!editing && !treeMode))
  el('edit').setAttribute('aria-pressed', String(editing))
  el('schema-preview').hidden = !current?.schemaPreview
  el('reader').hidden = editing || treeMode
  el('tree-panel').hidden = !treeMode
  el('tree').setAttribute('aria-pressed', String(treeMode))
  el<HTMLButtonElement>('tree').disabled = !current || !/\.(json|ya?ml)$/.test(current.path) || Boolean(current.errors.length)
  el('editor-panel').hidden = !editing
}
function files() {
  const query = el<HTMLInputElement>('search').value.toLowerCase().trim()
  const group = el<HTMLSelectElement>('group').value
  const entries = data.entries.filter(e => (!group || e.group === group) && `${e.path}\n${e.text}`.toLowerCase().includes(query))
  el('count').textContent = `${entries.length} of ${data.entries.length} files`
  renderFileTree(el('files'), entries, current?.path, Boolean(query || group), path => { select(path) })
}
function renderValue(value: unknown, target: HTMLElement, depth = 0, path = '') {
  if (value === null || typeof value !== 'object') { target.append(node('p', String(value ?? 'null'), 'value')); return }
  const entries = Object.entries(value)
  if (!entries.length) { target.append(node('span', Array.isArray(value) ? 'Empty list' : 'Empty mapping', 'empty')); return }
  for (const [key, item] of entries) {
    const field = path ? `${path}.${key}` : key
    if (item && typeof item === 'object') {
      const d = document.createElement('details'); d.open = depth < 2; d.className = `value-group depth-${depth % 4}`
      const title = Array.isArray(value) && !Array.isArray(item) ? String((item as Record<string, unknown>).title ?? (item as Record<string, unknown>).label ?? (item as Record<string, unknown>).name ?? (item as Record<string, unknown>).id ?? `Item ${Number(key) + 1}`) : key.replaceAll('_', ' ')
      d.id = `field-${field}`; d.append(node('summary', title)); renderValue(item, d, depth + 1, field); target.append(d)
    } else {
      const row = node('div', undefined, 'value-row'); row.id = `field-${field}`; row.append(node('span', key, 'key'))
      const v = node('span', String(item ?? 'null'), 'value'); v.dir = 'auto'; row.append(v); target.append(row)
    }
  }
}
function inline(target: HTMLElement, text: string) {
  const pattern = /\*\*([^*]+)\*\*|`([^`]+)`/g
  let cursor = 0
  for (const match of text.matchAll(pattern)) {
    target.append(document.createTextNode(text.slice(cursor, match.index)))
    target.append(node(match[1] ? 'strong' : 'code', match[1] ?? match[2]))
    cursor = match.index! + match[0].length
  }
  target.append(document.createTextNode(text.slice(cursor)))
}
function read() {
  const reader = el('reader'); reader.replaceChildren()
  if (!current) return
  el('errors').textContent = current.errors.join('\n')
  if (dirty()) reader.append(node('p', 'Reading the saved file. Your unsaved draft remains in Edit source.', 'hint'))
  if (current.value !== null && !current.errors.length) renderValue(current.value, reader)
  else {
    // A conservative Markdown reading view: no embedded HTML or executable links.
    let paragraph: string[] = []; let start = 1; let code = false
    const flush = () => {
      if (!paragraph.length) return
      let p: HTMLElement
      if (!code && paragraph.length > 1 && /^\|?\s*:?-{3,}/.test(paragraph[1])) {
        p = node('table')
        paragraph.filter((_, i) => i !== 1).forEach((line, i) => {
          const row = node('tr')
          for (const cell of line.replace(/^\||\|$/g, '').split('|')) { const td = node(i === 0 ? 'th' : 'td'); inline(td, cell.trim()); row.append(td) }
          p.append(row)
        })
      } else { p = node(code ? 'pre' : 'p'); if (code) p.textContent = paragraph.join('\n'); else inline(p, paragraph.join('\n')) }
      p.classList.add('source-line'); p.id = `line-${start}`; p.dir = 'auto'; reader.append(p); paragraph = []
    }
    current.text.split('\n').forEach((line, i) => {
      if (line.startsWith('```')) { flush(); code = !code; start = i + 2; return }
      const heading = !code && /^(#{1,6})\s+(.+)$/.exec(line)
      if (heading) { flush(); const h = node(`h${Math.min(4, heading[1].length + 1)}`, heading[2], 'source-line'); h.id = `line-${i + 1}`; reader.append(h) }
      else if (!line.trim() && !code) flush()
      else { if (!paragraph.length) start = i + 1; paragraph.push(line) }
    }); flush()
  }
}
function jump(anchor: Anchor) {
  if (!select(anchor.file)) return
  editing = false; treeMode = false; controls()
  const key = anchor.key.endsWith('.$definition') ? anchor.key.replace(/\.\$definition$/, `.${anchor.label}`) : anchor.key
  const target = document.getElementById(`field-${key}`) ?? document.getElementById(`line-${anchor.line}`)
  if (target) {
    let parent: HTMLElement | null = target
    while (parent) { if (parent instanceof HTMLDetailsElement) parent.open = true; parent = parent.parentElement }
    target.scrollIntoView({block: 'center'}); target.classList.add('highlight'); setTimeout(() => target.classList.remove('highlight'), 1800)
  }

}
function linkButton(anchor: Anchor, detail: string) {
  const b = button(anchor.label, () => jump(anchor), 'reference')
  b.append(node('small', `${detail} · ${anchor.file}:${anchor.line}`)); return b
}
function relationships() {
  for (const id of ['outline', 'outgoing', 'incoming']) el(id).replaceChildren()
  if (!current) return
  for (const h of current.headings) el('outline').append(linkButton(h, h.key))
  const outgoing = data.links.filter(l => l.from.file === current!.path)
  for (const link of outgoing) {
    if (!link.to.length) el('outgoing').append(node('p', `${link.from.label} — unresolved in indexed files (${link.from.key}, line ${link.from.line})`, 'unresolved'))
    else for (const target of link.to) el('outgoing').append(linkButton(target, `${link.kind} · ${link.from.key}`))
  }
  const seen = new Set<string>()
  for (const link of data.links.filter(l => l.from.file !== current!.path && l.to.some(t => t.file === current!.path))) {
    const key = `${link.from.file}:${link.from.line}`
    if (!seen.has(key)) { seen.add(key); el('incoming').append(linkButton(link.from, link.kind)) }
  }
  for (const id of ['outline', 'outgoing', 'incoming']) if (!el(id).childNodes.length) el(id).append(node('p', 'None indexed.', 'empty'))
}
function select(path: string): boolean {
  if (busy) return false
  if (current?.path === path) return true
  if (dirty() && !confirm('Discard unsaved edits and open another file?')) return false
  const entry = data.entries.find(e => e.path === path)
  if (!entry) return false
  current = entry; draft = entry.text; editor.value = draft; editing = false; treeMode = false
  el('path').textContent = entry.path
  el('title').textContent = entry.headings.find(h => /(^|\.)(name|title|label)$/.test(h.key) || h.key === 'heading')?.label ?? entry.path.split('/').at(-1)!
  status(`${entry.editable ? 'Editable source' : 'Read-only source'} · ${entry.text.split('\n').length} lines · Syntax checks only; content design remains under review.`)
  history.replaceState(null, '', `#${encodeURIComponent(path)}`)
  files(); read(); relationships(); controls(); el('reader').closest('main')!.scrollTop = 0
  return true
}
async function refresh() {
  if (dirty() && !confirm('Discard unsaved edits and reload files from disk?')) return
  const selected = current?.path
  busy = true; controls()
  try {
    const response = await fetch('/api/catalog'); const result = await response.json()
    if (!response.ok) throw Error(result.error)
    data = result
    const group = el<HTMLSelectElement>('group'); const chosen = group.value
    group.replaceChildren(new Option('All collections', ''))
    for (const name of [...new Set(data.entries.map(e => e.group))]) group.add(new Option(name, name))
    group.value = chosen
    current = undefined; draft = ''; busy = false; files()
    select((selected ?? decodeURIComponent(location.hash.slice(1))) || 'docs/notes/language-guides-and-xp/pilot-guides.md')
    if (!current && data.entries[0]) select(data.entries[0].path)
  } catch (error) { status(String(error)) }
  finally { busy = false; controls() }
}
el('read').onclick = () => { editing = false; treeMode = false; read(); controls() }
el('edit').onclick = () => { editing = true; treeMode = false; controls(); editor.focus() }
el('search').oninput = files; el('group').onchange = files
editor.oninput = () => { draft = editor.value; controls() }
el('discard').onclick = () => { if (current && confirm('Discard unsaved edits?')) { draft = current.text; editor.value = draft; controls(); read() } }
el('refresh').onclick = () => setupLayout()
el('tree').onclick = () => { if (!current) return; treeMode = true; editing = false; renderTree(current.value, el('tree-canvas')); controls() }
el('expand-tree').onclick = () => expandTree(el('tree-canvas'), true)
el('collapse-tree').onclick = () => expandTree(el('tree-canvas'), false)
el('tree-zoom').oninput = () => { el('tree-canvas').style.zoom = `${el<HTMLInputElement>('tree-zoom').value}%` }
void refresh()
el('save').onclick = async () => {
  if (!current || busy) return
  busy = true; controls()
  try {
    const response = await fetch('/api/save', { method: 'POST', headers: {'Content-Type': 'application/json', 'X-Workbench-Token': document.querySelector<HTMLMetaElement>('meta[name=workbench-token]')!.content}, body: JSON.stringify({path: current.path, text: draft, revision: current.revision}) })
    const result = await response.json()
    if (!response.ok) throw Error(result.error)
    current = result; draft = result.text; data.entries = data.entries.map(e => e.path === result.path ? result : e)
    el('errors').textContent = ''; status('Saved. Refresh files to rebuild the reference index.'); read()
    if (treeMode) renderTree(current!.value, el('tree-canvas'))
    const indexed = await fetch('/api/catalog'); const updated = await indexed.json()
    if (!indexed.ok) throw Error(`Saved, but reference refresh failed: ${updated.error}`)
    data = updated; relationships(); files(); status('Saved to disk. Reference index updated. Application semantics have not been validated.')
  } catch (error) { el('errors').textContent = String(error) }
  finally { busy = false; controls() }
}
window.addEventListener('beforeunload', event => { if (dirty()) { event.preventDefault(); event.returnValue = '' } })
setupLayout()
el('tree').onclick = () => { if (!current) return; treeMode = true; editing = false; renderTree(current.value, el('tree-canvas')); controls() }
el('expand-tree').onclick = () => expandTree(el('tree-canvas'), true)
el('collapse-tree').onclick = () => expandTree(el('tree-canvas'), false)
el('tree-zoom').oninput = () => { el('tree-canvas').style.zoom = `${el<HTMLInputElement>('tree-zoom').value}%` }
void refresh()

el('schema-preview').onclick = () => {
  if (!current?.schemaPreview) return
  editing = false; treeMode = false; controls()
  const preview = current.schemaPreview
  const reader = el('reader'); reader.replaceChildren(node('h3', 'Schema shape'))
  for (const note of preview.notes) reader.append(node('p', note, 'hint'))
  reader.append(node('h3', 'Illustrative YAML'), node('pre', preview.yaml))
  const table = node('table'); const head = node('tr')
  for (const title of ['Field path', 'Presence', 'Type']) head.append(node('th', title))
  table.append(head)
  for (const field of preview.fields) { const row = node('tr'); for (const text of [field.path, field.presence, field.type]) row.append(node('td', text)); table.append(row) }
  reader.append(table)
  status('Schema shape preview · placeholders, not a valid completed document or runtime prompt.')
}
