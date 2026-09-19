import { create } from 'zustand'

/// Whether any recorded operation of the open conversation is running. The
/// conversation's snapshot watcher sets it; the top bar reads it.
export const useAiBusyStore = create<{ busy: boolean; setBusy: (busy: boolean) => void }>(set => ({
  busy: false,
  setBusy: busy => set(state => state.busy === busy ? state : { busy }),
}))
