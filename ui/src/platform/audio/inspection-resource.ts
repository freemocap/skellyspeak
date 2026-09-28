import type { AudioInspection } from '../../generated/contracts'

/** Hydrated inspection responses, shared by every surface. Native owns durable
 * signal reuse; this avoids a loading flash and duplicate IPC on visibility changes.
 * Keys include consumer/evidence identity; the native signal key is audio-only. */
type Entry = { pending: Promise<AudioInspection>; value?: AudioInspection; bytes: number }
const entries = new Map<string, Entry>()
const limit = 32 * 1024 * 1024

export function clearInspectionResources() { entries.clear() }
export function invalidateInspectionResources(matches: (key: string) => boolean) {
  for (const key of entries.keys()) if (matches(key)) entries.delete(key)
}

export function peekInspection(key: string): AudioInspection | null {
  return entries.get(key)?.value ?? null
}

export function inspectionResource(key: string, load: () => Promise<AudioInspection>): Promise<AudioInspection> {
  const existing = entries.get(key)
  if (existing) { entries.delete(key); entries.set(key, existing); return existing.pending }
  const entry: Entry = { pending: Promise.resolve().then(load), bytes: key.length * 2 }
  entries.set(key, entry)
  entry.pending = entry.pending.then(value => {
    // A workspace reset or eviction cannot publish into a newer resource.
    if (entries.get(key) !== entry) return value
    entry.value = value
    entry.bytes += JSON.stringify(value).length * 2
    let bytes = [...entries.values()].reduce((sum, item) => sum + item.bytes, 0)
    for (const [oldKey, old] of entries) {
      if (bytes <= limit) break
      if (old.value) { entries.delete(oldKey); bytes -= old.bytes }
    }
    return value
  }, error => { if (entries.get(key) === entry) entries.delete(key); throw error })
  return entry.pending
}
