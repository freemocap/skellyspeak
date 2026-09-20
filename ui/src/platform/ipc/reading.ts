import type { ReadingInput, ReadingResult } from '../../generated/contracts'
import { invoke } from './native'
import { reportFault } from '../diagnostics/faults'

export async function readSelection(input: ReadingInput, signal: AbortSignal): Promise<ReadingResult> {
  signal.throwIfAborted()
  const id = await invoke<string>('begin_reading', { input })
  const cancel = () => { void invoke<void>('cancel_reading', { id }).catch(error => reportFault('Closing reading help', error)) }
  if (signal.aborted) { cancel(); signal.throwIfAborted() }
  signal.addEventListener('abort', cancel, { once: true })
  try { const result = await invoke<ReadingResult>('run_reading', { id }); signal.throwIfAborted(); return result }
  finally { signal.removeEventListener('abort', cancel) }
}
export function readingActivity(): Promise<unknown> { return invoke<unknown>('get_reading_activity') }
