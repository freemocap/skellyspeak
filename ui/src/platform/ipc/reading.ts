import type { ReadingInput, ReadingResult } from '../../generated/contracts'
import { invoke } from './native'
import { ownedRequest } from './owned-request'

export async function readSelection(input: ReadingInput, signal: AbortSignal): Promise<ReadingResult> {
  return ownedRequest(signal, () => invoke<string>('begin_reading', { input }),
    id => invoke<ReadingResult>('run_reading', { id }),
    id => invoke<void>('cancel_reading', { id }), 'Closing reading help')
}
export function readingActivity(): Promise<unknown> { return invoke<unknown>('get_reading_activity') }
