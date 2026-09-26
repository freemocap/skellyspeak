import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { setupLayout } from './layout.ts'
import { renderTree, expandTree } from './tree.ts'
const { JSDOM } = createRequire(import.meta.url)('jsdom')

test('panes collapse independently, reopen, resize with keys, and retain layout without changing editor text', () => {
  const dom = new JSDOM(readFileSync(new URL('./index.html', import.meta.url), 'utf8'), {url: 'http://localhost'})
  const {window} = dom
  Object.assign(globalThis, {window, document: window.document, HTMLElement: window.HTMLElement, HTMLDetailsElement: window.HTMLDetailsElement})
  Object.defineProperty(globalThis, 'localStorage', {value: window.localStorage, configurable: true})
  const doc = window.document
  doc.getElementById('editor').value = 'unsaved: العربية'
  setupLayout()
  for (const id of ['files-pane', 'document-pane', 'connections-pane']) {
    const toggle = doc.querySelector(`[data-pane="${id}"]`)
    toggle.click(); assert.equal(doc.getElementById(id).hidden, true)
    toggle.click(); assert.equal(doc.getElementById(id).hidden, false)
  }
  const grip = doc.querySelector('[data-resize="files-pane"]')
  grip.dispatchEvent(new window.KeyboardEvent('keydown', {key: 'ArrowRight'}))
  assert.equal(doc.getElementById('files-pane').style.width, '180px')
  assert.match(window.localStorage.getItem('content-workbench-layout-v1'), /180px/)
  doc.getElementById('reset-layout').click()
  assert.equal(doc.getElementById('files-pane').style.width, '')
  assert.equal(doc.getElementById('editor').value, 'unsaved: العربية')
  dom.window.close()
})

test('tree represents arrays, empty values and original Unicode, with working branch and global toggles', () => {
  const dom = new JSDOM('<div id="tree"></div>')
  Object.assign(globalThis, {document: dom.window.document})
  const root = dom.window.document.getElementById('tree')
  renderTree({name: 'é e\u0301 العربية', children: [{empty: []}, null, false]}, root)
  assert(root.textContent.includes('é e\u0301 العربية'))
  assert(root.textContent.includes('array · 3'))
  assert(root.textContent.includes('array · 0'))
  assert(root.textContent.includes('false'))
  expandTree(root, false)
  assert([...root.querySelectorAll('.tree-children')].every((n: any) => n.hidden))
  root.querySelector('button').click()
  assert.equal(root.querySelector('.tree-children').hidden, false)
  expandTree(root, true)
  assert([...root.querySelectorAll('.tree-children')].every((n: any) => !n.hidden))
  dom.window.close()
})

test('file navigation mirrors disk nesting and retains parent paths during search', async () => {
  const { renderFileTree } = await import('./tree.ts')
  const dom = new JSDOM('<div id="files"></div>')
  Object.assign(globalThis, {document: dom.window.document})
  const container = dom.window.document.getElementById('files')
  const paths = ['content/languages/german.yaml', 'content/prompts/conversation/instructions.yaml', 'content/prompts/drill/instructions.yaml', 'docs/notes/pilot.md', 'references.bib']
  let selected = ''
  renderFileTree(container, paths.map(path => ({path})), paths[0], false, path => { selected = path })
  const folder = container.querySelector('[data-path="content/prompts/conversation"]')
  assert.equal(folder.parentElement.closest('details').dataset.path, 'content/prompts')
  assert.equal(container.querySelector('[data-path="content/languages"]').open, true)
  const button = folder.querySelector('button'); button.click()
  assert.equal(selected, paths[1])
  assert.equal(button.getAttribute('aria-label'), paths[1])
  renderFileTree(container, [{path: paths[2]}], undefined, true, () => {})
  assert.equal(container.querySelectorAll('button').length, 1)
  assert.equal(container.querySelector('[data-path="content/prompts/drill"]').open, true)
  assert.equal(container.querySelector('[data-path="content/prompts"]').open, true)
  assert.equal(container.querySelector('[data-path="content"]').open, true)
  dom.window.close()
})
