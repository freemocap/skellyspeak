// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, waitFor } from '@testing-library/dom'

const policy = { max_users: 10, free_daily_micros: 500000, extended_daily_micros: 500000, global_daily_micros: 500000, account_requests: 2000, global_requests: 10000, diagnostics_requests: 120, global_diagnostics: 600, revision: 0 }
const requests: string[] = []
afterEach(() => { window.dispatchEvent(new Event('pagehide')); vi.useRealTimers(); vi.unstubAllGlobals() })
beforeEach(async () => {
  vi.resetModules(); requests.length = 0
  const html = readFileSync('tools/admin.html', 'utf8')
  document.body.innerHTML = html.split('<body id="admin-console">')[1].split('</body>')[0]
  vi.stubGlobal('fetch', vi.fn(async (path: string) => {
    requests.push(path)
    const data = path.includes('/logs') ? { entries: [], scope: 'Test logs', since: '2026-09-20T12:00:00Z' } : path.includes('/timeline') ? { points: [{ time: '2026-09-20T12:00:00Z', present: true, micros: 12345, requests: 2, tokens: 20 }], scope: 'UTC bucket starts' } : {
      policy, environment_defaults: policy, generated_at: '2026-09-20T12:00:00Z', environment: 'Test', administrator: 'Test', revision: 'local', account_count: 1, global_admission: {}, users: [], global_usage: [{ day: '2026-09-20', micros: 12345 }],
    }
    return { ok: true, status: 200, json: async () => data }
  }))
  await import('./entry')
  await waitFor(() => expect(document.querySelector('#policy-global_daily_micros')).not.toBeNull())
})
it('adjusts dollars by one dollar while accepting typed cents', () => {
  const input = document.querySelector<HTMLInputElement>('#policy-global_daily_micros')!
  const plus = input.parentElement!.querySelectorAll('button')[1]
  fireEvent.click(plus)
  expect(input.value).toBe('1.5')
  expect(input.type).toBe('text')
  input.value = '0.75'
  fireEvent.click(plus)
  expect(input.value).toBe('1.75')
})
it('shows readable UTC dates and selects practical resolutions for broad ranges', async () => {
  expect(document.querySelector('#usage-chart')!.textContent).toContain('Sep 20')
  expect(document.querySelector('#usage-chart')!.textContent).toContain('12:00 UTC')
  const range = document.querySelector<HTMLSelectElement>('#chart-range')!
  const interval = document.querySelector<HTMLSelectElement>('#chart-interval')!
  fireEvent.change(range, { target: { value: '3mo' } })
  await waitFor(() => expect(requests.at(-1)).toContain('span=3mo&interval=1d'))
  await waitFor(() => expect(document.body.hasAttribute('aria-busy')).toBe(false))
  fireEvent.change(interval, { target: { value: '1m' } })
  await waitFor(() => expect(requests.at(-1)).toContain('span=1d&interval=1m'))
})


it('streams snapshots over one WebSocket without HTTP polling and preserves draft fields', async () => {
  vi.useFakeTimers()
  let socket: FakeSocket | undefined
  class FakeSocket {
    static OPEN = 1
    readyState = 1
    onopen?: () => void
    onmessage?: (event: { data: string }) => void
    onclose?: () => void
    onerror?: () => void
    send = vi.fn((_value: string) => {})
    close = vi.fn()
    constructor(public url: URL) { socket = this }
  }
  vi.stubGlobal('WebSocket', FakeSocket)
  const before = requests.length
  fireEvent.click(document.querySelector<HTMLInputElement>('#live')!)
  socket!.onopen!()
  expect(socket!.url.pathname).toBe('/admin/live')
  expect(socket!.send).toHaveBeenCalledTimes(1)
  const selection = JSON.parse(String(socket!.send.mock.calls[0][0]))
  const input = document.querySelector<HTMLInputElement>('#policy-global_daily_micros')!
  input.value = '8.25'
  socket!.onmessage!({ data: JSON.stringify({ type: 'snapshot', selection,
    overview: { policy, environment_defaults: policy, generated_at: '2026-09-20T12:01:00Z', global_usage: [{ micros: 456 }], global_admission: {}, users: [] },
    timeline: { points: [], scope: 'Live chart' }, logs: { entries: [], scope: 'Live events', since: '' } }) })
  await vi.advanceTimersByTimeAsync(60000)
  expect(requests.length).toBe(before)
  expect(document.querySelector('#status')!.textContent).toContain(new Date('2026-09-20T12:01:00Z').toLocaleString())
  expect(input.value).toBe('8.25')
  fireEvent.click(document.querySelector<HTMLInputElement>('#live')!)
  expect(socket!.close).toHaveBeenCalledOnce()
})
it('shows a disconnected state without automatic reconnect requests', async () => {
  class FakeSocket {
    static OPEN = 1
    close = vi.fn()
    onclose?: () => void
    constructor() { queueMicrotask(() => this.onclose?.()) }
  }
  vi.stubGlobal('WebSocket', FakeSocket)
  fireEvent.click(document.querySelector<HTMLInputElement>('#live')!)
  await waitFor(() => expect(document.querySelector('#live-status')!.textContent).toContain('disconnected'))
  expect(document.querySelector<HTMLInputElement>('#live')!.checked).toBe(false)
})

it('labels local daily limits as disabled while retaining usage counts', async () => {
  const original = vi.mocked(fetch).getMockImplementation()!
  vi.mocked(fetch).mockImplementation(async (...args) => {
    const response = await original(...args)
    const data = await response.json()
    return { ...response, json: async () => ({ ...data, usage_limits_enforced: false,
      global_admission: { account_requests: 2500, diagnostics_requests: 150 },
    }) } as Response
  })
  fireEvent.click(document.querySelector('#refresh')!)
  await waitFor(() => expect(document.querySelector('#status')!.textContent).toContain('Daily usage limits disabled'))
  expect(document.querySelector('#summary')!.textContent).toContain('Shared daily limitDisabled')
  expect(document.querySelector('#summary')!.textContent).toContain('Inference admissions2500')
  expect(document.querySelector('#summary')!.textContent).toContain('$0.012345')
  expect(document.querySelector('#policy-fields')!.textContent).toContain('--enforce-usage-limits')
})
