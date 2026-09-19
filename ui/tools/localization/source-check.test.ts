import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkUiSource, missingCatalogMessages } from './source-check.ts'
import { auditMessages } from './usage.ts'

const check = (source: string, keys: string[] = []) => checkUiSource('Example.tsx', source, new Set(keys))
test('finds prose hidden in JSX expressions, conditional branches and accessible templates', () => {
  for (const source of ["<p>{'Untranslated'}</p>", "<p>{ok ? 'Yes please' : 'No thanks'}</p>", '<button title={`Ask about ${term}`} />', '<div aria-valuetext={`${count} points`} />', '<p>{ready && "Ready now"}</p>', '<p>{"未翻译"}</p>']) assert.ok(check(source).some(error => error.includes('untranslated UI text')), source)
})
test('checks literal keys in conditional translation calls and template literals', () => {
  assert.equal(check("<p>{tr(ok ? 'Yes' : 'No')}</p>", ['Yes']).length, 1)
  assert.equal(check('<p>{tr(`Missing`)}</p>').length, 1)
  assert.deepEqual(check("<p>{tr(ok ? 'Yes' : 'No')}</p>", ['Yes', 'No']), [])
})
test('leaves identities, user content, units and translated output alone', () => {
  assert.deepEqual(check('<p className="notice" data-state="pending">{text}{tr("Ready")}{enabled && tr("Ready")} XP</p>', ['Ready']), [])
  assert.deepEqual(check('<label>{size}px</label>'), [])
})
test('rejects locale-independent decimal formatting in UI components', () => {
  assert.equal(check('<p>{number.toFixed(2)}</p>').length, 1)
  assert.deepEqual(check('<p>{tr.number(number, { maximumFractionDigits: 2 })}</p>'), [])
})
test('requires every catalog label, description and criterion', () => {
  assert.deepEqual(missingCatalogMessages([{ label: 'Label', description: 'Description', criterion: 'Criterion' }], new Set(['Label'])), ['Description', 'Criterion'])
})
test('usage audit retains dynamic metadata and flags only unreferenced candidates', () => {
  const usage = auditMessages(['Direct', 'Dynamic', 'Removed', 'Line\nbreak'], [
    { path: 'View.tsx', text: "tr('Direct'); const labels = ['Dynamic']; tr(labels[0])" },
    { path: 'data.json', text: JSON.stringify({ label: 'Line\nbreak' }) },
  ])
  assert.deepEqual(usage.filter(item => item.direct.length).map(item => item.key), ['Direct'])
  assert.deepEqual(usage.filter(item => !item.references.length).map(item => item.key), ['Removed'])
})

test('identifiers, comments and longer messages do not keep retired keys alive', () => {
  const usage = auditMessages(['Map', 'New chat', 'Kept'], [
    { path: 'View.tsx', text: "// Map\nconst map = new Map(); tr('✚ New chat'); const title = 'Kept'" },
    { path: 'catalog.json', text: JSON.stringify({ label: 'New chat options', description: 'Map the route' }) },
  ])
  assert.deepEqual(usage.filter(item => !item.references.length).map(item => item.key), ['Map', 'New chat'])
  assert.deepEqual(usage.find(item => item.key === 'Kept')!.references, ['View.tsx'])
})
