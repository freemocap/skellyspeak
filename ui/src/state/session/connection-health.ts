import { create } from 'zustand'
import { invoke } from '../../platform/ipc/native'
import type { AccessCheck, ConnectionConfig, ConnectionRoute } from '../../generated/contracts'

export type ConnectionHealth = {
  providers?: AccessCheck['providers']
  revision: number
  status: 'checking' | 'connected' | 'disconnected'
  checkedAt: number | null
  error: string | null
}
type State = {
  routes: Partial<Record<ConnectionRoute, ConnectionHealth>>
  check: (connection: ConnectionConfig, force?: boolean) => Promise<void>
  record: (route: ConnectionRoute, revision: number, error?: unknown, result?: AccessCheck) => void
  begin: (route: ConnectionRoute, revision: number) => void
  offline: () => void
}
const errorMessage = (error: unknown) => error instanceof Error ? error.message
  : typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : String(error)

export const useConnectionHealth = create<State>((set, get) => ({
  routes: {},
  begin: (route, revision) => set(state => ({ routes: { ...state.routes, [route]: { revision, status: 'checking', checkedAt: null, error: null } } })),
  record: (route, revision, error, result) => set(state => ({ routes: { ...state.routes,
    [route]: { revision, providers: result?.providers,
      status: error === undefined && (!result || result.providers.every(provider => provider.state === 'accepted')) ? 'connected' : 'disconnected',
      checkedAt: Date.now(), error: error === undefined ? null : errorMessage(error) },
  } })),
  offline: () => set(state => ({ routes: Object.fromEntries(Object.entries(state.routes).map(([route, health]) =>
    [route, { ...health, status: 'disconnected', checkedAt: Date.now(), error: 'Device is offline.' }])) })),
  check: async (connection, force = false) => {
    const { route, revision } = connection
    const previous = get().routes[route]
    if (previous?.revision === revision && (previous.status === 'checking' ||
      (!force && previous.checkedAt !== null && Date.now() - previous.checkedAt < 60_000))) return
    const pending: ConnectionHealth = { revision, status: 'checking', checkedAt: null, error: null }
    set(state => ({ routes: { ...state.routes, [route]: pending } }))
    try {
      if (!connection.configured) throw new Error('Set up this connection in AI access settings.')
      let result: AccessCheck | undefined
      if (route === 'custom') result = await invoke<AccessCheck>('check_access', { expectedRevision: revision })
      else await invoke('hosted_account')
      if (get().routes[route] === pending) get().record(route, revision, undefined, result)
    } catch (error) {
      if (get().routes[route] === pending) get().record(route, revision, error)
    }
  },
}))
