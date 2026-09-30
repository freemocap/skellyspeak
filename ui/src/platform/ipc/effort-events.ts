/** A durable reading publication can change effort without changing a chat snapshot. */
const listeners = new Set<() => void>()
export function onEffortPublished(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export function effortPublished(): void {
  for (const listener of listeners) listener()
}
