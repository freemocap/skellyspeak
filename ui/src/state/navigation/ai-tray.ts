import { create } from 'zustand'

/// Where the phone's AI View opens as a tray: the place above the recording
/// panel of the page showing one. Null while no recording panel shows; the
/// view then opens full screen.
export const useAiTrayStore = create<{ slot: HTMLElement | null }>(() => ({ slot: null }))

/// A ref callback for a page with a recording panel. It hands the element to
/// the AI View while attached and takes it back on cleanup, unless another
/// page has claimed the slot since.
export function aiTraySlot(element: HTMLElement | null): (() => void) | undefined {
  if (!element) return undefined
  useAiTrayStore.setState({ slot: element })
  return () => { if (useAiTrayStore.getState().slot === element) useAiTrayStore.setState({ slot: null }) }
}
