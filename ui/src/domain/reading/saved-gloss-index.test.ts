import { expect, it } from 'vitest'
import { savedGlossIndex } from './saved-gloss-index'
const scope = {language:'spanish', variety:'spain', explanation:'english', explanationVariety:'us'}
it('reuses saved words across sentences with immediate exact-source precedence', () => {
  const resolve = savedGlossIndex([
    {scope,text:'La playa.',segments:[{start:3,end:8,kind:'gloss',gloss:'beach',pronunciation:'pla-ya'}]},
    {scope,text:'playa',segments:[{start:0,end:5,kind:'gloss',gloss:'shore'}]},
  ])
  expect(resolve('Otra playa.',scope)[0]).toMatchObject({start:5,end:10,gloss:'beach / shore',pronunciation:'pla-ya'})
  expect(resolve('La playa.',scope)[0].gloss).toBe('beach')
  expect(resolve('playa',{...scope,variety:'mexico'})).toEqual([])
  expect(resolve('playa',{...scope,explanation:'french'})).toEqual([])
  expect(resolve('Playa',scope)).toEqual([])
})
it('keeps Arabic clitic offsets when reusing the joined surface word', () => {
  const arabic = {...scope,language:'arabic'}
  const resolve=savedGlossIndex([{scope:arabic,text:'البيت',segments:[{start:0,end:2,kind:'gloss',gloss:'the'},{start:2,end:5,kind:'gloss',gloss:'house'}]}])
  expect(resolve('في البيت',arabic).map(part=>[part.start,part.end,part.gloss])).toEqual([[3,5,'the'],[5,8,'house']])
})
it('does not create overlapping spans when saved analyses use different clitic boundaries', () => {
  const resolve=savedGlossIndex([
    {scope,text:'البيت',segments:[{start:0,end:2,kind:'gloss',gloss:'the'},{start:2,end:5,kind:'gloss',gloss:'house'}]},
    {scope,text:'البيت.',segments:[{start:0,end:5,kind:'gloss',gloss:'the home'}]},
  ])
  expect(resolve('في البيت',scope)).toEqual([{start:3,end:8,kind:'gloss',gloss:'the house / the home',romanization:undefined,pronunciation:undefined}])
})
