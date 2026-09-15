import { configureAudioVolumes } from '../platform/audio/audio-volume'
import { reportFault } from '../platform/diagnostics/faults'
import { isTauri } from '../platform/ipc/tauri'
import { useSessionStore } from './session'
import { useSettingsStore } from './settings'

/// Start every store that needs work before the first render, from one place.
///
/// Called once, from `main.tsx`. There is no "start it again if a component
/// needs it" path: a test that renders a component seeds the store it needs, and
/// a second start would be a second reader racing the first.
///
/// Outside Tauri nothing is started. That decision is made here, once, rather
/// than repeated as a guard inside each store.
export async function initStores(): Promise<void> {
  if (!isTauri) return

  // Audio volumes follow the settings record wherever it changes. A failure to
  // apply them is reported and the record is left alone: blanking it would take
  // every preference away from every reader over a device problem.
  useSettingsStore.subscribe((state, previous) => {
    if (state.settings === previous.settings || !state.settings) return
    try { configureAudioVolumes(state.settings) }
    catch (error) { reportFault('Audio settings', error) }
  })

  await Promise.all([
    useSettingsStore.getState().load().catch((error: unknown) => reportFault('Loading settings', error)),
    useSessionStore.getState().refresh().catch((error: unknown) => reportFault('Loading AI access', error)),
  ])
}
