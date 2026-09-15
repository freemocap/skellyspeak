import { expect, it } from 'vitest'
import { anchoredTokenGlosses, glossDisplayGroups } from './gloss-display'

it('keeps separate Arabic words and punctuation separate, without changing saved anchors', () => {
  const segments = [{ start: 0, end: 2, kind: 'gloss' as const, gloss: 'the' }, { start: 2, end: 6, kind: 'gloss' as const, gloss: 'book' }, { start: 7, end: 10, kind: 'gloss' as const, gloss: 'here' }]
  expect(glossDisplayGroups('الكتاب هنا؟', segments)).toEqual([
    { start: 0, end: 6, parts: segments.slice(0, 2) }, { start: 7, end: 10, parts: segments.slice(2) },
  ])
  expect(segments[0].end).toBe(2)
})

it('does not group adjacent Chinese words or turn Latin words into phrases', () => {
  const segments = [{ start: 0, end: 1, kind: 'gloss' as const, gloss: 'I' }, { start: 1, end: 2, kind: 'gloss' as const, gloss: 'you' }]
  expect(glossDisplayGroups('我你', segments)).toHaveLength(2)
})

it('anchors repeated semantic tokens to the original source instead of inserting spaces', () => {
  const token = {text:'ال', gloss:'the', romanization:null, pronunciation:null, pos:null, notable:false}
  expect(anchoredTokenGlosses('الكتاب،  البيت؟', [token, {...token,text:'كتاب'}, token, {...token,text:'بيت'}]).map(({start,end})=>[start,end])).toEqual([[0,2],[2,6],[9,11],[11,14]])
})
