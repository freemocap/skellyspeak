import { beforeEach, expect, it, vi } from 'vitest'
import { useSessionStore } from './session'
import { reportFault } from '../platform/diagnostics/faults'
import type { ConnectionConfig } from '../contracts'

const native = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('../platform/ipc/tauri', () => ({ invoke: native.invoke }))
vi.mock('../platform/diagnostics/faults', () => ({ reportFault: vi.fn() }))

const connection = (over: Partial<ConnectionConfig> = {}): ConnectionConfig => ({
  route: 'hosted', signedIn: true, ownKeyConfigured: false, email: 'learner@example.test',
  revision: 1, configured: true, standardModel: '', fastModel: '', paused: false, ...over,
})

beforeEach(() => {
  native.invoke.mockReset()
  vi.mocked(reportFault).mockClear()
})

it('reads the route projection', async () => {
  native.invoke.mockResolvedValue(connection({ route: 'custom', revision: 4 }))
  await useSessionStore.getState().refresh()
  expect(native.invoke).toHaveBeenCalledWith('get_connection')
  expect(useSessionStore.getState().connection?.revision).toBe(4)
})

it('puts the core on the hosted route before signing in', async () => {
  native.invoke
    .mockResolvedValueOnce(connection({ route: 'custom', revision: 7 }))
    .mockResolvedValueOnce(connection({ route: 'hosted', revision: 8 }))
    .mockResolvedValueOnce({ email: 'learner@example.test' })
    .mockResolvedValueOnce(connection({ route: 'hosted', revision: 8, email: 'learner@example.test' }))
  await useSessionStore.getState().startHostedSignIn()
  // The order is what makes the sign-in land on the revision the UI is showing.
  expect(native.invoke.mock.calls.map(call => call[0])).toEqual(['get_connection', 'select_route', 'hosted_sign_in', 'get_connection'])
  expect(native.invoke).toHaveBeenCalledWith('select_route', { expectedRevision: 7, route: 'hosted' })
  expect(useSessionStore.getState().connection?.email).toBe('learner@example.test')
})

it('selects no route when the core is already on the hosted one', async () => {
  native.invoke.mockResolvedValue(connection())
  await useSessionStore.getState().startHostedSignIn()
  expect(native.invoke.mock.calls.map(call => call[0])).toEqual(['get_connection', 'hosted_sign_in', 'get_connection'])
})

it('runs one sign-in at a time', async () => {
  let release: (value: ConnectionConfig) => void = () => { throw new Error('No request') }
  native.invoke.mockImplementationOnce(() => new Promise<ConnectionConfig>(done => { release = done })).mockResolvedValue(connection())
  const first = useSessionStore.getState().startHostedSignIn()
  await useSessionStore.getState().startHostedSignIn()
  expect(native.invoke).toHaveBeenCalledTimes(1)
  release(connection())
  await first
  expect(useSessionStore.getState().signingIn).toBe(false)
})

it('reports a failed sign-in, and stays ready to try again', async () => {
  native.invoke.mockRejectedValue(new Error('no network'))
  await useSessionStore.getState().startHostedSignIn()
  expect(reportFault).toHaveBeenCalledWith('Signing in with Google', expect.any(Error))
  // The flag is cleared in a failure, or the button would never work again.
  expect(useSessionStore.getState().signingIn).toBe(false)
  native.invoke.mockClear()
  await useSessionStore.getState().startHostedSignIn()
  expect(native.invoke).toHaveBeenCalled()
})

it('ignores an older route read that completes after a new one', async () => {
  let finish!: (value: ConnectionConfig) => void
  native.invoke.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    .mockResolvedValueOnce(connection({ route: 'custom', revision: 2 }))
  const old = useSessionStore.getState().refresh()
  await useSessionStore.getState().refresh()
  finish(connection())
  await old
  expect(useSessionStore.getState().connection?.route).toBe('custom')
})

it('invalidates pending route reads on a public store reset', async () => {
  let finish!: (value: ConnectionConfig) => void
  native.invoke.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const old = useSessionStore.getState().refresh()
  useSessionStore.setState(useSessionStore.getInitialState(), true)
  finish(connection())
  await old
  expect(useSessionStore.getState().connection).toBeNull()
})
