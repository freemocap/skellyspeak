import { logDiagnostic } from './log'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dismissAllFaults, dismissFault, reportFault, subscribeFaults } from './faults'

vi.mock('./log', () => ({ logDiagnostic: vi.fn().mockResolvedValue(true) }))

describe('the fault bus', () => {
  beforeEach(() => dismissAllFaults())

  it('delivers a reported failure to subscribers', async () => {
    const seen: string[][] = []
    const stop = subscribeFaults((f) => seen.push(f.map((x) => `${x.context}: ${x.message}`)))
    reportFault('Speech', new Error('no voice'))
    await Promise.resolve()
    stop()
    expect(seen.at(-1)).toEqual(['Speech: no voice'])
  })

  it('accepts a plain string as well as an Error', async () => {
    let latest: string[] = []
    const stop = subscribeFaults((f) => (latest = f.map((x) => x.message)))
    reportFault('Startup', 'settings.json could not be read')
    await Promise.resolve()
    stop()
    expect(latest).toEqual(['settings.json could not be read'])
  })

  it('keeps every fault, so one does not hide another', async () => {
    let latest: unknown[] = []
    const stop = subscribeFaults((f) => (latest = f))
    reportFault('Speech', new Error('a'))
    reportFault('Microphone', new Error('b'))
    await Promise.resolve()
    stop()
    expect(latest).toHaveLength(2)
  })

  it('dismisses one fault without touching the rest', async () => {
    let latest: { id: number; message: string }[] = []
    const stop = subscribeFaults((f) => (latest = f))
    reportFault('Speech', new Error('a'))
    reportFault('Microphone', new Error('b'))
    await Promise.resolve()
    dismissFault(latest[0].id)
    await Promise.resolve()
    stop()
    expect(latest.map((f) => f.message)).toEqual(['b'])
  })
})

it('waits for durable acknowledgement before publishing a caught fault', async () => {
  dismissAllFaults()
  let acknowledge!: (value: boolean) => void
  vi.mocked(logDiagnostic).mockReturnValueOnce(new Promise(resolve => { acknowledge = resolve }))
  let latest: unknown[] = []
  const stop = subscribeFaults(faults => { latest = faults })
  reportFault('Speech', new Error('PRIVATE_TRANSCRIPT'))
  expect(latest).toHaveLength(0)
  acknowledge(true)
  await Promise.resolve()
  expect(latest).toHaveLength(1)
  stop()
})
