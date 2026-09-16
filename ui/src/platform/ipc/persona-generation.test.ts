import { beforeEach, expect, it, vi } from 'vitest'
import { beginPersonaGeneration, runPersonaGeneration, cancelPersonaGeneration } from './workspace'

const native = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('./native', () => ({ invoke: native.invoke }))
beforeEach(() => native.invoke.mockReset())

it('reserves generation with a normalized optional brief', async () => {
  native.invoke.mockResolvedValue('generation')
  expect(await beginPersonaGeneration('spanish', '  fisher  ')).toBe('generation')
  expect(native.invoke).toHaveBeenLastCalledWith('begin_persona_generation', { languageId: 'spanish', brief: 'fisher' })
  await beginPersonaGeneration('french', '   ')
  expect(native.invoke).toHaveBeenLastCalledWith('begin_persona_generation', { languageId: 'french', brief: null })
})

it('runs and cancels only the admitted generation ID', async () => {
  native.invoke.mockResolvedValue(undefined)
  await runPersonaGeneration('generation')
  expect(native.invoke).toHaveBeenLastCalledWith('run_persona_generation', { generationId: 'generation' })
  await cancelPersonaGeneration('generation')
  expect(native.invoke).toHaveBeenLastCalledWith('cancel_persona_generation', { generationId: 'generation' })
})

it('reads global generation metadata without a generation command', async () => {
  native.invoke.mockResolvedValue({ revision: 1, attempts: [], usage: { attempts: 0, inputTokens: 0, outputTokens: 0, unknownUsage: 0 } })
  const { readPersonaGenerationActivity } = await import('./workspace')
  await readPersonaGenerationActivity()
  expect(native.invoke).toHaveBeenCalledExactlyOnceWith('get_persona_generation_activity')
})
