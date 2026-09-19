import { create } from 'zustand'
import { aiWindowState } from '../../platform/ipc/window'

/// Whether the AI View lives in its own desktop window. Always read back from
/// native: events only prompt `refresh`, so a reload or a missed event cannot
/// leave this stale.
interface AiWindowStore {
  supported: boolean
  open: boolean
  refresh: () => Promise<void>
}

export const useAiWindowStore = create<AiWindowStore>(set => ({
  supported: false,
  open: false,
  refresh: async () => {
    const state = await aiWindowState()
    set({ supported: state.supported, open: state.open })
  },
}))
