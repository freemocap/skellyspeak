import assert from 'node:assert/strict'
import { test } from 'node:test'
import { batches, parseTests, partitionTests } from './native-tests.ts'

test('native ownership partitions every test once, including nested migration tests', () => {
  const tests = parseTests('ai::transport::reply: test\r\napplication::tests::ai::reply: test\r\nstorage::store::migrations::v54::history: test\r\nstorage::store::tests::schema: test\r\nconfiguration::tests::content: test\r\n')
  const groups = partitionTests(tests, 'pub mod ai;\npub(crate) mod application;\npub mod storage;\npub mod configuration;\n')
  assert.deepEqual(Object.keys(groups), ['ai', 'application', 'configuration', 'storage', 'storage-migrations'])
  assert.deepEqual(groups.ai, ['ai::transport::reply'])
  assert.deepEqual(groups['storage-migrations'], ['storage::store::migrations::v54::history'])
  assert.deepEqual(Object.values(groups).flat().sort(), tests)
  // New declared domains join the inventory automatically, without editing a matrix.
  assert.deepEqual(partitionTests(['new_domain::case'], 'pub mod new_domain;'), { new_domain: ['new_domain::case'] })
})

test('missing ownership and malformed or duplicate test lists fail explicitly', () => {
  for (const listing of ['', 'a: test\na: test', 'a: benchmark', 'unexpected output']) assert.throws(() => parseTests(listing))
  assert.throws(() => partitionTests(['unowned::case'], 'pub mod ai;'), /no declared module owner/)
  assert.throws(() => partitionTests(['ai::case', 'ai::case'], 'pub mod ai;'), /duplicate/)
})

test('exact-name batches stay within Windows argument bounds without dropping tests', () => {
  const tests = Array.from({ length: 500 }, (_, index) => `conversations::execution::tests::case_${index}`)
  const result = batches(tests, 200)
  assert.ok(result.length > 1)
  assert.deepEqual(result.flat(), tests)
  assert.ok(result.every(batch => batch.length && batch.reduce((n, name) => n + name.length + 3, 0) <= 200))
  assert.throws(() => batches(['too_long'], 5), /command limit/)
  assert.deepEqual(batches([]), [])
})
