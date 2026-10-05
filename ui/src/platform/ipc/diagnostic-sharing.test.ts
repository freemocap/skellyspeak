// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { supportsLogSharing } from './diagnostic-sharing'

const runtime = vi.hoisted(() => ({ isTauri: true }))
vi.mock('./tauri', () => runtime)
vi.mock('./native', () => ({ invoke: vi.fn() }))
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); runtime.isTauri = true })

it.each([
  ['Android', 'Linux armv8l', 5, true],
  ['iPhone', 'iPhone', 5, true],
  ['iPad', 'iPad', 5, true],
  ['Macintosh', 'MacIntel', 5, true],
  ['Macintosh', 'MacIntel', 0, false],
  ['Windows', 'Win32', 10, false],
  ['Linux', 'Linux x86_64', 0, false],
])('routes %s (%s, %s touch points) to the appropriate export UI', (userAgent, platform, maxTouchPoints, expected) => {
  vi.stubGlobal('navigator', { userAgent, platform, maxTouchPoints })
  expect(supportsLogSharing()).toBe(expected)
})

it('does not offer native sharing in a mobile browser preview', () => {
  runtime.isTauri = false
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone')
  expect(supportsLogSharing()).toBe(false)
})
