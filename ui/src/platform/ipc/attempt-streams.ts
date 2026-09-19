import { isTauri } from './tauri'
import { invoke } from './native'
import type { AttemptStreamRead, AttemptStreamUpdate } from '../../generated/contracts'

/// Every change to a streaming attempt, pushed by native. Each carries the full
/// text so far and a sequence number, so any single event is complete.
export async function onAttemptStream(handler: (update: AttemptStreamUpdate) => void): Promise<() => void> {
  if (!isTauri) return () => {}
  const { listen } = await import('@tauri-apps/api/event')
  return listen<AttemptStreamUpdate>('ai-attempt-stream', event => handler(event.payload))
}

/// The authoritative current text of every streaming attempt in a
/// conversation, for windows that open or reload mid-stream.
export function readAttemptStreams(conversationId: string): Promise<AttemptStreamRead> {
  if (!isTauri) return Promise.resolve({ generation: 0, entries: [] })
  return invoke<AttemptStreamRead>('read_attempt_streams', { conversationId })
}
