import { openUrl } from '@tauri-apps/plugin-opener'
import { expect, it, vi } from 'vitest'
import { openExternalLink } from './external-link'

vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }))

it('opens the URL through the system browser, not the app webview', async () => {
  await openExternalLink('https://example.org/free-software')
  expect(openUrl).toHaveBeenCalledExactlyOnceWith('https://example.org/free-software')
})
