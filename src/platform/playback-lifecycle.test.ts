import { readFileSync } from 'node:fs'
import { expect, it, vi } from 'vitest'
import { installNativePlaybackLifecycle } from './playback-lifecycle'
import capabilities from '../../src-tauri/capabilities/main.json'

const native = vi.hoisted(() => ({ focus: vi.fn(), listen: vi.fn() }))
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({
  onFocusChanged: native.focus, listen: native.listen,
}) }))

it('connects native focus and mobile suspension events and removes all listeners', async () => {
  const unlisten = vi.fn()
  native.focus.mockResolvedValue(unlisten)
  native.listen.mockResolvedValue(unlisten)
  const lifecycle = { focus: vi.fn(), close: vi.fn(), suspend: vi.fn(), resume: vi.fn(), dispose: vi.fn() }
  const dispose = await installNativePlaybackLifecycle(lifecycle)
  const event = (name: string) => native.listen.mock.calls.find(([wired]) => wired === name)![1]
  native.focus.mock.calls[0][0]({ payload: false })
  event('tauri://suspended')()
  event('tauri://resumed')()
  expect(lifecycle.focus).toHaveBeenCalledWith(false)
  expect(lifecycle.suspend).toHaveBeenCalledOnce()
  expect(lifecycle.resume).toHaveBeenCalledOnce()
  dispose()
  expect(unlisten).toHaveBeenCalledTimes(3)
  expect(lifecycle.dispose).toHaveBeenCalledOnce()
})

/// While the page listens for a close request, Tauri holds the close and waits for
/// the page to destroy the window, so the window cannot be closed.
it('never listens for a window close request', async () => {
  native.focus.mockResolvedValue(vi.fn())
  native.listen.mockResolvedValue(vi.fn())
  native.listen.mockClear()
  await installNativePlaybackLifecycle({ focus: vi.fn(), close: vi.fn(), suspend: vi.fn(), resume: vi.fn(), dispose: vi.fn() })
  expect(native.listen.mock.calls.map(([name]) => name)).not.toContain('tauri://close-requested')
  const source = readFileSync(new URL('./playback-lifecycle.ts', import.meta.url), 'utf8')
  expect(source).not.toMatch(/onCloseRequested\(|WINDOW_CLOSE_REQUESTED/)
})

it('limits external navigation to the download page', () => {
  expect(capabilities.windows).toEqual(['main', 'ai'])
  expect(capabilities.permissions).toEqual(['core:default', { identifier: 'opener:allow-open-url', allow: [{ url: 'https://docs.freemocap.org/skellyspeak/download' }] }])
})
