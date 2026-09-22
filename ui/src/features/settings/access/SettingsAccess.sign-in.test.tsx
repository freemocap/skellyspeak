// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { SettingsAccess } from './SettingsAccess'

const native = vi.hoisted(() => vi.fn())
vi.mock('../../../platform/ipc/native', () => ({ invoke: native }))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

let signIn: ReturnType<typeof deferred<unknown>>
let signedIn: boolean
beforeEach(() => {
  signedIn = false
  signIn = deferred()
  native.mockReset()
  native.mockImplementation(async (command: string) => {
    if (command === 'local_server_available') return false
    if (command === 'get_connection') return { route: 'hosted', signedIn, email: '', revision: 1 }
    if (command === 'get_access_settings') return { revision: 1, custom: { baseUrl: '', bearerAuth: false } }
    if (command === 'hosted_sign_in') return signIn.promise
    if (command === 'cancel_sign_in') return
    throw new Error(`Unexpected native command: ${command}`)
  })
})

async function start() {
  const onBusyChange = vi.fn()
  const onChanged = vi.fn(async () => {})
  const view = render(<SettingsAccess onBusyChange={onBusyChange} onChanged={onChanged} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Sign in with Google' }))
  await screen.findByText('Waiting for sign-in to finish…')
  return { ...view, onBusyChange, onChanged }
}

it('keeps Cancel usable while sign-in locks the form, then waits for native cancellation to settle', async () => {
  const { onBusyChange } = await start()
  expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Cancel sign-in' })).toBeEnabled()
  expect(onBusyChange).toHaveBeenLastCalledWith(true)
  fireEvent.click(screen.getByRole('button', { name: 'Cancel sign-in' }))
  await waitFor(() => expect(native).toHaveBeenCalledWith('cancel_sign_in'))
  expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeDisabled()
  await act(async () => { signIn.reject(new Error('Sign-in cancelled.')) })
  expect(screen.getByRole('alert')).toHaveTextContent('Sign-in cancelled.')
  expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeEnabled()
  expect(screen.queryByRole('button', { name: 'Cancel sign-in' })).toBeNull()
  expect(onBusyChange).toHaveBeenLastCalledWith(false)
})

it('refreshes the account and unlocks after a successful callback', async () => {
  const { onChanged, onBusyChange } = await start()
  signedIn = true
  await act(async () => { signIn.resolve({ usedUsd: 0, limitUsd: 1, tokensToday: 0, requestsToday: 0 }) })
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeEnabled()
  expect(screen.queryByText('Waiting for sign-in to finish…')).toBeNull()
  expect(onChanged).toHaveBeenCalledOnce()
  expect(onBusyChange).toHaveBeenLastCalledWith(false)
  expect(native).not.toHaveBeenCalledWith('cancel_sign_in')
})

it('unlocks and displays the native timeout instead of remaining busy', async () => {
  await start()
  await act(async () => { signIn.reject(new Error('Sign-in timed out. Try again.')) })
  expect(screen.getByRole('alert')).toHaveTextContent('Sign-in timed out. Try again.')
  expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeEnabled()
})

it('cancels an outstanding attempt when its settings view is removed', async () => {
  const { unmount } = await start()
  unmount()
  expect(native).toHaveBeenCalledWith('cancel_sign_in')
  await act(async () => { signIn.reject(new Error('Sign-in cancelled.')) })
})

it('retains a usable cancel action and reports a cancellation-command failure', async () => {
  const implementation = native.getMockImplementation()!
  native.mockImplementation((command: string) => command === 'cancel_sign_in'
    ? Promise.reject(new Error('Cancellation failed.')) : implementation(command))
  await start()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel sign-in' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Cancellation failed.')
  expect(screen.getByRole('button', { name: 'Cancel sign-in' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeDisabled()
  await act(async () => { signIn.reject(new Error('Sign-in timed out. Try again.')) })
})
