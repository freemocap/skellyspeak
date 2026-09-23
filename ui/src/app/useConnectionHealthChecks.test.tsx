// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { useConnectionHealthChecks } from './useConnectionHealthChecks'
import { useConnectionHealth } from '../state/session/connection-health'
import { useSessionStore } from '../state/session/session'
import type { ConnectionConfig } from '../generated/contracts'

const native = vi.hoisted(() => vi.fn())
vi.mock('../platform/ipc/native', () => ({ invoke: native }))
beforeEach(() => { native.mockReset(); native.mockResolvedValue({ providers: [] }); useConnectionHealth.setState({ routes: {} }) })

it.each(['custom', 'hosted'] as const)('checks %s automatically on startup and reconnect, without a click', async route => {
  const connection: ConnectionConfig = { route, revision: 1, configured: true, signedIn: true,
    email: '', paused: false, assessmentAdapter: 'chat_model', standardModel: 'standard', fastModel: 'fast',
    audio: { transcription: { model: 'scribe_v2' }, speech: { model: 'eleven_v3' } } }
  useSessionStore.setState({ connection })
  const view = renderHook(useConnectionHealthChecks)
  await waitFor(() => expect(useConnectionHealth.getState().routes[route]?.status).toBe('connected'))
  expect(native).toHaveBeenCalledTimes(1)
  expect(native.mock.calls[0][0]).toBe(route === 'custom' ? 'check_access' : 'hosted_account')
  // Returning from a system dialog reuses the recent result rather than looping.
  act(() => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')) })
  expect(native).toHaveBeenCalledTimes(1)
  act(() => { window.dispatchEvent(new Event('offline')) })
  expect(useConnectionHealth.getState().routes[route]?.status).toBe('disconnected')
  act(() => { window.dispatchEvent(new Event('online')) })
  await waitFor(() => expect(native).toHaveBeenCalledTimes(2))
  await waitFor(() => expect(useConnectionHealth.getState().routes[route]?.status).toBe('connected'))
  act(() => { useSessionStore.setState({ connection: { ...connection, revision: 2 } }) })
  await waitFor(() => expect(native).toHaveBeenCalledTimes(3))
  await waitFor(() => expect(useConnectionHealth.getState().routes[route]?.status).toBe('connected'))
  view.unmount()
  // A fresh webview has fresh JS state and automatically checks again.
  useConnectionHealth.setState({ routes: {} })
  renderHook(useConnectionHealthChecks)
  await waitFor(() => expect(native).toHaveBeenCalledTimes(4))
})
