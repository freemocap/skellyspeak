import { beforeEach, expect, it, vi } from 'vitest'
import type { Snapshot } from '../../generated/contracts'
import { saveMyLanguage } from './my-languages'
const mocks = vi.hoisted(() => ({ read: vi.fn(), execute: vi.fn() }))
vi.mock('./workspace', async importOriginal => ({ ...await importOriginal<typeof import('./workspace')>(), readWorkspace: mocks.read, executeAction: mocks.execute }))
const snapshot = () => ({
  sessionId: 'session',
  learner: { revision: 3, name: 'Learner', preferences: { myLanguages: [], targetVarieties: {}, interfaceLocale: 'english' } },
  languages: [{id:'spanish',varieties:[{id:'spanish-mexico'}]}, {id:'arabic',varieties:[{id:'arabic-levantine'}]}],
  conversations: [{id:'chat',languageId:'spanish',archived:false,lastUsed:1}],
}) as unknown as Snapshot
beforeEach(() => { vi.clearAllMocks(); mocks.read.mockResolvedValue(snapshot()); mocks.execute.mockResolvedValue({}) })
it('adds a shared learner shortcut and variety without starting or opening a chat', async () => {
  await saveMyLanguage('arabic','arabic-levantine')
  expect(mocks.execute).toHaveBeenCalledExactlyOnceWith(snapshot(), {
    kind:'updateLearner',expectedRevision:3,name:'Learner',
    preferences:{myLanguages:['spanish','arabic'],targetVarieties:{arabic:'arabic-levantine'},interfaceLocale:'english'},
  })
})
it('removes only membership and preserves the remembered variety', async () => {
  const current = snapshot()
  current.learner.preferences.myLanguages = ['spanish','arabic']
  current.learner.preferences.targetVarieties = {arabic:'arabic-levantine'}
  mocks.read.mockResolvedValue(current)
  await saveMyLanguage('arabic',null)
  expect(mocks.execute.mock.calls[0][1].preferences).toEqual({...current.learner.preferences,myLanguages:['spanish']})
})
it('rejects active removal, unknown languages and mismatched varieties before any mutation', async () => {
  await expect(saveMyLanguage('spanish',null)).rejects.toThrow('Switch languages')
  await expect(saveMyLanguage('missing','missing')).rejects.toThrow('language is unavailable')
  await expect(saveMyLanguage('arabic','spanish-mexico')).rejects.toThrow('variety is unavailable')
  expect(mocks.execute).not.toHaveBeenCalled()
})
it('propagates revision conflicts instead of overwriting another preference edit', async () => {
  mocks.execute.mockRejectedValue({code:'conflict',message:'Learner changed'})
  await expect(saveMyLanguage('arabic','arabic-levantine')).rejects.toEqual({code:'conflict',message:'Learner changed'})
  expect(mocks.execute).toHaveBeenCalledTimes(1)
})

it('saves script scale independently of membership and resets only the chosen language', async () => {
  const { saveScriptScale } = await import('./my-languages')
  const current = snapshot()
  current.learner.preferences.scriptScales = {spanish:1.25}
  mocks.read.mockResolvedValue(current)
  await saveScriptScale('arabic',2)
  expect(mocks.execute.mock.calls[0][1].preferences).toEqual({...current.learner.preferences,scriptScales:{spanish:1.25,arabic:2}})
  await saveScriptScale('spanish',null)
  expect(mocks.execute.mock.calls[1][1].preferences.scriptScales).toEqual({})
  mocks.execute.mockClear()
  await expect(saveScriptScale('arabic',NaN)).rejects.toThrow('Script size')
  await expect(saveScriptScale('arabic',4)).rejects.toThrow('Script size')
  await expect(saveScriptScale('missing',1)).rejects.toThrow('unavailable')
  expect(mocks.execute).not.toHaveBeenCalled()
})
