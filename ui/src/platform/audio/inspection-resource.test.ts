import { expect, it, vi } from 'vitest'
import type { AudioInspection } from '../../generated/contracts'
import { clearInspectionResources, inspectionResource, peekInspection } from './inspection-resource'

const signal = { duration: 1 } as AudioInspection
it('shares pending work, retains the result, and isolates different evidence', async () => {
  const load = vi.fn(async () => signal)
  const a = inspectionResource('same', load)
  const b = inspectionResource('same', load)
  expect(a).toBe(b)
  await a
  expect(peekInspection('same')).toBe(signal)
  expect(await inspectionResource('same', load)).toBe(signal)
  expect(load).toHaveBeenCalledOnce()
  await inspectionResource('different-timing', load)
  expect(load).toHaveBeenCalledTimes(2)
})

it('allows failure retry and prevents a previous workspace from repopulating the cache', async () => {
  const load = vi.fn().mockRejectedValueOnce(new Error('failed')).mockResolvedValue(signal)
  await expect(inspectionResource('retry', load)).rejects.toThrow('failed')
  expect(await inspectionResource('retry', load)).toBe(signal)
  let complete!: (value: AudioInspection) => void
  const old = inspectionResource('old', () => new Promise(resolve => { complete = resolve }))
  await Promise.resolve()
  clearInspectionResources()
  complete(signal); await old
  expect(peekInspection('old')).toBeNull()
})
