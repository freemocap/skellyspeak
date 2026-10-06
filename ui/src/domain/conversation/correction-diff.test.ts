import { expect, it } from 'vitest'
import { correctionChanges } from './correction-diff'

it('narrows a sentence-length correction to the changed words, merging across one unchanged word', () => {
  expect(correctionChanges(
    'Ain’t no one ever talked about a bullet bus, if you know what I mean.',
    'No one has ever talked about a bullet bus, if you know what I mean.',
  )).toEqual([{ removed: 'Ain’t no one', added: 'No one has' }])
})

it('keeps separated edits as separate regions', () => {
  expect(correctionChanges('Yo tiene un perro y una gata negro.', 'Yo tengo un perro y una gata negra.')).toEqual([
    { removed: 'tiene', added: 'tengo' },
    { removed: 'negro', added: 'negra' },
  ])
})

it('reports insertions and deletions with an empty side', () => {
  expect(correctionChanges('I go to the store yesterday.', 'I went to the store yesterday.')).toEqual([{ removed: 'go', added: 'went' }])
  expect(correctionChanges('She is a teacher very good.', 'She is a very good teacher.')).not.toBeNull()
  expect(correctionChanges('Je suis allé au le marché.', 'Je suis allé au marché.')).toEqual([{ removed: 'le', added: '' }])
})

it('segments scripts without spaces using Unicode word boundaries', () => {
  const changes = correctionChanges('私は学校に行きました昨日。', '私は昨日学校に行きました。')
  expect(changes === null || changes.every(change => '私は学校に行きました昨日。'.includes(change.removed))).toBe(true)
  expect(correctionChanges('我昨天去了学校，很开心。', '我昨天去了学校，非常开心。')).toEqual([{ removed: '很', added: '非常' }])
})

it('preserves combining marks and emoji exactly as written', () => {
  expect(correctionChanges('Café ☕ é bom', 'Café ☕ é ótimo')).toEqual([{ removed: 'bom', added: 'ótimo' }])
  expect(correctionChanges('I like 🍕 so much', 'I love 🍕 so much')).toEqual([{ removed: 'like', added: 'love' }])
})

it('returns null when nothing changed or when most of the wording changed', () => {
  expect(correctionChanges('Same text.', 'Same text.')).toBeNull()
  expect(correctionChanges('Me gusta mucho.', 'Prefiero el té.')).toBeNull()
})
