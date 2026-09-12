import { logDiagnostic } from './log'
import { describe, expect, it, vi } from 'vitest'
import { reportFault, useFaultStore } from './faults'

vi.mock('./log', () => ({ logDiagnostic: vi.fn().mockResolvedValue(true) }))

/// Publication is synchronous, so a test reads the store rather than subscribing
/// to watch a value arrive. `__mocks__/zustand.ts` empties it between tests.
const faults = () => useFaultStore.getState().faults

describe('the fault bus', () => {
  it('publishes a reported failure', () => {
    reportFault('Speech', new Error('no voice'))
    expect(faults().map(f => `${f.context}: ${f.message}`)).toEqual(['Speech: no voice'])
  })

  it('accepts a plain string as well as an Error', () => {
    reportFault('Startup', 'settings.json could not be read')
    expect(faults().map(f => f.message)).toEqual(['settings.json could not be read'])
  })

  it('keeps every fault, so one does not hide another', () => {
    reportFault('Speech', new Error('a'))
    reportFault('Microphone', new Error('b'))
    expect(faults()).toHaveLength(2)
  })

  it('dismisses one fault without touching the rest', () => {
    reportFault('Speech', new Error('a'))
    reportFault('Microphone', new Error('b'))
    useFaultStore.getState().dismiss(faults()[0].id)
    expect(faults().map(f => f.message)).toEqual(['b'])
  })

  it('clears them all', () => {
    reportFault('Speech', new Error('a'))
    useFaultStore.getState().dismissAll()
    expect(faults()).toEqual([])
  })
})

it('shows a fault even when the durable log rejects, and reports that separately', async () => {
  vi.mocked(logDiagnostic).mockRejectedValueOnce(new Error('sink unavailable'))
  reportFault('Speech', new Error('PRIVATE_TRANSCRIPT'))
  // Showing the problem does not wait on the sink: waiting meant a failing log
  // swallowed the fault, which is the one outcome this module prevents.
  expect(faults().map(f => f.message)).toContain('PRIVATE_TRANSCRIPT')
  await vi.waitFor(() => expect(faults().some(f => f.context === 'Diagnostics')).toBe(true))
})
