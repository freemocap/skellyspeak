import type { RecordingOwner } from '../../generated/contracts'

// Completion belongs to the recording, even when its initiating component has
// unmounted. Durable native publication finishes before this notification.
const listeners = new Set<(owner: RecordingOwner) => void>()
export function onRecordingPublished(listener: (owner: RecordingOwner) => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export function recordingPublished(owner: RecordingOwner): void {
  for (const listener of listeners) listener(owner)
}
