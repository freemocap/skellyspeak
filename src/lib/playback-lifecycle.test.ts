import { expect, it, vi } from 'vitest'
import { installNativePlaybackLifecycle } from './playback-lifecycle'

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
