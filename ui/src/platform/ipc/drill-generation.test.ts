import { beforeEach, expect, it, vi } from 'vitest'
import { previewDrillItems, acceptDrillItems, conversationDrillCandidates } from './drill-generation'
const native = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('./native', () => native)
vi.mock('../diagnostics/faults', () => ({ reportFault: vi.fn() }))
const input = { language: 'spanish', variety: null, explanation: 'english', explanationVariety: null, topic: null, count: 3, difficulty: 'beginner' as const, length: 'shortPhrase' as const }
beforeEach(() => native.invoke.mockReset())
it('cancels a late reservation without running or automatically regenerating', async () => {
  let release!: (id: string) => void
  native.invoke.mockImplementation(command => command === 'begin_drill_preview' ? new Promise(resolve => { release = resolve }) : Promise.resolve())
  const controller = new AbortController()
  const result = previewDrillItems(input, controller.signal)
  controller.abort(); release('preview')
  await expect(result).rejects.toThrow()
  expect(native.invoke).toHaveBeenCalledWith('cancel_drill_preview', { requestId: 'preview' })
  expect(native.invoke.mock.calls.some(([command]) => command === 'preview_drill_items')).toBe(false)
})
it('acceptance sends only candidate identities and extraction sends no generation request', async () => {
  native.invoke.mockResolvedValue([])
  await acceptDrillItems('preview', ['candidate'])
  expect(native.invoke).toHaveBeenLastCalledWith('accept_drill_items', { requestId: 'preview', candidateIds: ['candidate'] })
  await conversationDrillCandidates({ scope: { language: 'spanish', variety: null, explanation: 'english', explanationVariety: null }, cursor: null, limit: 10 })
  expect(native.invoke).toHaveBeenLastCalledWith('conversation_drill_candidates', { input: expect.objectContaining({ limit: 10 }) })
  expect(native.invoke).toHaveBeenCalledTimes(2)
})
