import { beforeEach, expect, it, vi } from 'vitest'
import { useConnectionHealth } from './connection-health'
import type { ConnectionConfig } from '../../generated/contracts'
const native = vi.hoisted(() => vi.fn())
vi.mock('../../platform/ipc/native', () => ({ invoke: native }))
const connection: ConnectionConfig = { route: 'custom', revision: 1, configured: true,
  signedIn: false, ownKeyConfigured: false, email: '', paused: false,
  standardModel: 'standard', fastModel: 'fast', audio: { transcription: { model: 'transcription' }, speech: { model: 'openai/gpt-audio-mini' } } }
const verified = { providers: ['OPENROUTER', 'GROQ'].map(provider => ({ provider, state: 'accepted', status: 200, durationMs: 10 })) }
beforeEach(() => { native.mockReset(); useConnectionHealth.setState({ routes: {} }) })
it('checks the saved token and reuses recent results without inference', async () => {
  native.mockResolvedValue(verified)
  await useConnectionHealth.getState().check(connection)
  await useConnectionHealth.getState().check(connection)
  expect(native).toHaveBeenCalledExactlyOnceWith('check_access', { expectedRevision: 1, custom: true })
  expect(useConnectionHealth.getState().routes.custom).toMatchObject({ status: 'connected', revision: 1, error: null })
})
it('does not let an older successful request overwrite a newer refusal', async () => {
  let finish!: (value: string) => void
  native.mockImplementationOnce(() => new Promise<string>(resolve => { finish = resolve }))
  const old = useConnectionHealth.getState().check(connection)
  native.mockRejectedValueOnce({ message: 'Server rejected session token' })
  await useConnectionHealth.getState().check({ ...connection, revision: 2 })
  finish('verified'); await old
  expect(useConnectionHealth.getState().routes.custom).toMatchObject({ status: 'disconnected', revision: 2, error: 'Server rejected session token' })
})
it('invalidates an in-flight check on offline notification', async () => {
  let finish!: (value: string) => void
  native.mockImplementationOnce(() => new Promise<string>(resolve => { finish = resolve }))
  const pending = useConnectionHealth.getState().check(connection)
  useConnectionHealth.getState().offline()
  finish('verified'); await pending
  expect(useConnectionHealth.getState().routes.custom?.status).toBe('disconnected')
})
it('does not contact an unconfigured service', async () => {
  await useConnectionHealth.getState().check({ ...connection, configured: false })
  expect(native).not.toHaveBeenCalled()
  expect(useConnectionHealth.getState().routes.custom?.status).toBe('disconnected')
})
it.each(['openrouter', 'hosted'] as const)('checks %s with its own credential mechanism', async route => {
  native.mockResolvedValue({})
  await useConnectionHealth.getState().check({ ...connection, route })
  expect(native.mock.calls[0][0]).toBe(route === 'hosted' ? 'hosted_account' : 'verify_openrouter_key')
  expect(useConnectionHealth.getState().routes[route]?.status).toBe('connected')
})

it('never reports AI connected when an internal provider rejected its key', async () => {
  native.mockResolvedValue({ providers: [verified.providers[0], { ...verified.providers[1], state: 'rejected', status: 403 }] })
  await useConnectionHealth.getState().check(connection)
  expect(useConnectionHealth.getState().routes.custom).toMatchObject({ status: 'disconnected', providers: [
    { provider: 'OPENROUTER', state: 'accepted' }, { provider: 'GROQ', state: 'rejected', status: 403 },
  ] })
})
