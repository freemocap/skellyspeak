import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { catalog, inspect, readEntry, safePath } from './catalog.ts'
import { createWorkbench, save } from './server.ts'

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'content-workbench-'))
  for (const directory of ['content/languages', 'content/shared', 'content/schemas', 'docs/notes/language-guides-and-xp']) mkdirSync(join(root, directory), {recursive: true})
  writeFileSync(join(root, 'content/shared/learning-goals.yaml'), '- id: question\n  criterion: Ask something\n  sources: [example]\n')
  writeFileSync(join(root, 'content/shared/language-foundations.yaml'), 'scripts:\n- id: latin\northographies:\n  latin:\n    script: latin\n')
  writeFileSync(join(root, 'content/languages/sample.yaml'), '# preserve this comment\nidentity:\n  id: sample\n  name: Sample\ndefaults:\n  orthography:\n    shared: latin\nlearning:\n  goal_material:\n    question:\n      tokens: [¿Qué?]\n')
  writeFileSync(join(root, 'references.bib'), '@misc{example,\n  title = {Example}\n}\n')
  writeFileSync(join(root, 'content/schemas/test.json'), '{}')
  return {root, cleanup: () => rmSync(root, {recursive: true, force: true})}
}
test('indexes scoped definitions, skill mapping keys, citations and incoming references', () => {
  const f = fixture()
  try {
    const c = catalog(f.root)
    assert.equal(c.entries.length, 5)
    const scoped = c.links.find(l => l.kind === 'orthographies definition')!
    assert.equal(scoped.to[0].file, 'content/shared/language-foundations.yaml')
    assert.equal(scoped.to[0].line, 4)
    const skill = c.links.find(l => l.from.key.endsWith('$skill'))!
    assert.equal(skill.to[0].file, 'content/shared/learning-goals.yaml')
    const citation = c.links.find(l => l.from.label === 'example')!
    assert.equal(citation.to[0].file, 'references.bib')
  } finally { f.cleanup() }
})
test('saves exact comments and Unicode; rejects stale drafts, invalid YAML, traversal and symlinks', () => {
  const f = fixture()
  try {
    const path = 'content/languages/sample.yaml'; const before = readEntry(f.root, path)
    const text = `${before.text}example: "é e\u0301 مَرْحَبَا कि"\n`
    const after = save(f.root, path, text, before.revision)
    assert.equal(readFileSync(join(f.root, path), 'utf8'), text)
    assert.notEqual(after.revision, before.revision)
    assert.throws(() => save(f.root, path, 'x: y\n', before.revision), /Conflict/)
    assert.throws(() => save(f.root, path, 'a: 1\na: 2', after.revision), /invalid syntax/)
    assert.equal(readFileSync(join(f.root, path), 'utf8'), text)
    assert.throws(() => safePath(f.root, 'content/../references.bib'), /outside/)
    symlinkSync(join(f.root, 'references.bib'), join(f.root, 'content/link.yaml'))
    assert.throws(() => safePath(f.root, 'content/link.yaml'), /Symbolic/)
    assert(!catalog(f.root).entries.some(e => e.path.endsWith('link.yaml')))
    assert.throws(() => save(f.root, 'content/schemas/test.json', '{}', readEntry(f.root, 'content/schemas/test.json').revision), /read-only/)
    assert(inspect('x.yaml', 'example: [').errors.length)
  } finally { f.cleanup() }
})
test('HTTP editor requires same origin and session token; Unicode survives transport', async () => {
  const f = fixture(); const server = createWorkbench(f.root)
  try {
    await new Promise<void>(done => server.listen(0, '127.0.0.1', done))
    const addr = server.address(); assert(addr && typeof addr !== 'string')
    const base = `http://127.0.0.1:${addr.port}`
    const html = await (await fetch(base)).text()
    const token = /name="workbench-token" content="([^"]+)"/.exec(html)![1]
    const entry = readEntry(f.root, 'content/languages/sample.yaml')
    const body = JSON.stringify({path: entry.path, revision: entry.revision, text: `${entry.text}example: "العربية कि"\n`})
    assert.equal((await fetch(`${base}/api/save`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body})).status, 403)
    assert.equal((await fetch(`${base}/api/catalog`, {headers: {Origin: 'https://example.org'}})).status, 403)
    const saved = await fetch(`${base}/api/save`, {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Workbench-Token': token}, body})
    assert.equal(saved.status, 200)
    assert((await saved.json()).text.includes('العربية कि'))
    assert.equal((await fetch(`${base}/api/save`, {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Workbench-Token': token}, body})).status, 400)
  } finally { await new Promise<void>(done => server.close(() => done())); f.cleanup() }
})
