import { expect, it, vi } from 'vitest'
import { installNativePlaybackLifecycle } from './playback-lifecycle'
import capabilities from '../../src-tauri/capabilities/main.json'

const native = vi.hoisted(() => ({
  focus: vi.fn(), close: vi.fn(), listen: vi.fn(),
}))
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({
  onFocusChanged: native.focus, onCloseRequested: native.close, listen: native.listen,
}) }))

it('connects native focus, close, and mobile suspension events and removes all listeners', async () => {
  const unlisten = vi.fn()
  native.focus.mockResolvedValue(unlisten)
  native.close.mockResolvedValue(unlisten)
  native.listen.mockResolvedValue(unlisten)
  const lifecycle = { focus: vi.fn(), close: vi.fn(), suspend: vi.fn(), resume: vi.fn(), dispose: vi.fn() }
  const dispose = await installNativePlaybackLifecycle(lifecycle)
  native.focus.mock.calls[0][0]({ payload: false })
  native.close.mock.calls[0][0]()
  native.listen.mock.calls.find(([event]) => event === 'tauri://suspended')![1]()
  native.listen.mock.calls.find(([event]) => event === 'tauri://resumed')![1]()
  expect(lifecycle.focus).toHaveBeenCalledWith(false)
  expect(lifecycle.close).toHaveBeenCalledOnce()
  expect(lifecycle.suspend).toHaveBeenCalledOnce()
  expect(lifecycle.resume).toHaveBeenCalledOnce()
  dispose()
  expect(unlisten).toHaveBeenCalledTimes(4)
  expect(lifecycle.dispose).toHaveBeenCalledOnce()
})

it('records the rebuild window capability boundary without granting new permissions', () => {
  expect(capabilities.windows).toEqual(['main', 'ai'])
  expect(capabilities.permissions).toEqual(['core:default'])
})

it('SDK close cleanup calls destroy after its callback; native permission remains an integration prerequisite', async () => {
  const { Window } = await vi.importActual<typeof import('@tauri-apps/api/window')>('@tauri-apps/api/window')
  const appWindow: InstanceType<typeof Window> = Object.create(Window.prototype)
  const listen = vi.spyOn(appWindow, 'listen').mockResolvedValue(() => {})
  const destroy = vi.spyOn(appWindow, 'destroy').mockResolvedValue()
  const close = vi.fn()
  await appWindow.onCloseRequested(close)
  await listen.mock.calls[0][1]({ event: 'tauri://close-requested', id: 1, payload: null })
  expect(close).toHaveBeenCalledOnce()
  expect(destroy).toHaveBeenCalledOnce()
  expect(close.mock.invocationCallOrder[0]).toBeLessThan(destroy.mock.invocationCallOrder[0])
})
