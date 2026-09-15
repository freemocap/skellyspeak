import { create } from 'zustand'
import { reportFault } from '../platform/diagnostics/faults'
import { invoke } from '../platform/ipc/tauri'
import type { ConnectionConfig } from '../contracts'

/// AI access: which route the core is using, and whether a hosted sign-in is in
/// flight. Rust owns the route; this is the projection every surface reads,
/// rather than the shell threading three values through to the conversation.

interface SessionState {
  readRequest: object | null
  connection: ConnectionConfig | null
  /// A hosted sign-in is in flight. This is also the guard that stops a second.
  signingIn: boolean
  /// Re-read the route projection. Fails loudly; the caller reports.
  refresh: () => Promise<void>
  startHostedSignIn: () => Promise<void>
}

const initialState = {
  connection: null as ConnectionConfig | null,
  readRequest: null as object | null,
  signingIn: false,
}

export const useSessionStore = create<SessionState>((set, get) => ({
  ...initialState,

  refresh: async () => {
    const request = {}
    set({ readRequest: request })
    const connection = await invoke<ConnectionConfig>('get_connection')
    if (get().readRequest === request) set({ connection })
  },

  /// Two commands, in this order: put the core on the hosted route at the
  /// revision it reports, then sign in. Selecting the route first is what makes
  /// the sign-in land on the record the UI is already showing, which is why the
  /// `expectedRevision` and the order both matter.
  startHostedSignIn: async () => {
    if (get().signingIn) return
    set({ signingIn: true })
    try {
      let current = await invoke<ConnectionConfig>('get_connection')
      if (current.route !== 'hosted') {
        current = await invoke<ConnectionConfig>('select_route', {
          expectedRevision: current.revision,
          route: 'hosted',
        })
      }
      await invoke('hosted_sign_in')
      await get().refresh()
    } catch (error) {
      reportFault('Signing in with Google', error)
    } finally {
      set({ signingIn: false })
    }
  },
}))
