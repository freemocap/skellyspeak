// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { afterEach, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/dom'

afterEach(() => {
  window.dispatchEvent(new Event('pagehide'))
  vi.unstubAllGlobals()
})

it('boots the packaged script without source modules and renders API errors', async () => {
  const html = readFileSync('../server/app/diagnostics/admin_assets/index.html', 'utf8')
  document.body.innerHTML = html.split('<body id="admin-console">')[1].split('</body>')[0]
  const fetch = vi.fn(async () => ({
    ok: false, status: 503,
    json: async () => ({ detail: 'Service unavailable', code: 'SERVICE_UNAVAILABLE' }),
  }))
  vi.stubGlobal('fetch', fetch)
  // Execute the actual deployed asset: the source-module tests cannot detect
  // unresolved imports accidentally left by the standalone build tool.
  const bundle = readFileSync('../server/app/diagnostics/admin_assets/admin.js', 'utf8')
  new Function(bundle)()
  await waitFor(() => expect(document.querySelector('#error')?.textContent).toContain('Service unavailable'))
  expect(document.querySelector<HTMLElement>('#error')?.hidden).toBe(false)
  expect(fetch).toHaveBeenCalledOnce()
})
