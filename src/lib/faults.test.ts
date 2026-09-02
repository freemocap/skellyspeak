import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dismissAllFaults, dismissFault, reportFault, subscribeFaults } from './faults'

vi.mock('./log', () => ({ logError: () => {} }))

describe('the fault bus', () => {
  beforeEach(() => dismissAllFaults())

  it('delivers a reported failure to subscribers', () => {
    const seen: string[][] = []
    const stop = subscribeFaults((f) => seen.push(f.map((x) => `${x.context}: ${x.message}`)))
    reportFault('Speech', new Error('no voice'))
    stop()
    expect(seen.at(-1)).toEqual(['Speech: no voice'])
  })

  it('accepts a plain string as well as an Error', () => {
    let latest: string[] = []
    const stop = subscribeFaults((f) => (latest = f.map((x) => x.message)))
    reportFault('Startup', 'settings.json could not be read')
    stop()
    expect(latest).toEqual(['settings.json could not be read'])
  })

  it('keeps every fault, so one does not hide another', () => {
    let latest: unknown[] = []
    const stop = subscribeFaults((f) => (latest = f))
    reportFault('Speech', new Error('a'))
    reportFault('Microphone', new Error('b'))
    stop()
    expect(latest).toHaveLength(2)
  })

  it('dismisses one fault without touching the rest', () => {
    let latest: { id: number; message: string }[] = []
    const stop = subscribeFaults((f) => (latest = f))
    reportFault('Speech', new Error('a'))
    reportFault('Microphone', new Error('b'))
    dismissFault(latest[0].id)
    stop()
    expect(latest.map((f) => f.message)).toEqual(['b'])
  })
})
