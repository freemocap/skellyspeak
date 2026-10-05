import { isTauri } from './tauri'

/** Invalidation only: each window re-reads the authoritative native preferences. */
export async function executionPreferencesChanged(): Promise<void> {
  if (!isTauri) return
  const { emit } = await import('@tauri-apps/api/event')
  await emit('execution-preferences-changed')
}

export async function onExecutionPreferencesChanged(refresh: () => void): Promise<() => void> {
  if (!isTauri) return () => {}
  const { listen } = await import('@tauri-apps/api/event')
  return listen('execution-preferences-changed', refresh)
}
