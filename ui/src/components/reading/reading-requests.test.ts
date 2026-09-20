import { expect, it, vi } from 'vitest'
import { readingRequests } from './reading-requests'

it('coalesces concurrent requests while cancellation belongs to each consumer', async () => {
  const pool = readingRequests<string>()
  let complete!: (value: string) => void
  let owned!: AbortSignal
  const create = vi.fn((signal: AbortSignal) => { owned = signal; return new Promise<string>(resolve => { complete = resolve }) })
  const a = new AbortController(), b = new AbortController()
  const first = pool.run('same', a.signal, create)
  const second = pool.run('same', b.signal, create)
  await Promise.resolve()
  a.abort()
  await expect(first).rejects.toMatchObject({name:'AbortError'})
  expect(owned.aborted).toBe(false)
  complete('saved')
  await expect(second).resolves.toBe('saved')
  expect(create).toHaveBeenCalledOnce()
})

it('last consumer cancellation permits a fresh request and failures are not retained', async () => {
  const pool = readingRequests<string>()
  const a = new AbortController()
  let owned!: AbortSignal
  const first = pool.run('word', a.signal, signal => { owned = signal; return new Promise(() => {}) })
  await Promise.resolve()
  a.abort()
  await expect(first).rejects.toMatchObject({name:'AbortError'})
  expect(owned.aborted).toBe(true)
  await expect(pool.run('word', new AbortController().signal, async () => { throw new Error('provider failed') })).rejects.toThrow('provider failed')
  await expect(pool.run('word', new AbortController().signal, async () => 'fresh')).resolves.toBe('fresh')
})

it('clears old workspace ownership and does not coalesce different scopes', async () => {
  const pool = readingRequests<string>()
  const signals: AbortSignal[] = []
  const create = (signal: AbortSignal) => { signals.push(signal); return new Promise<string>((_, reject) => signal.addEventListener('abort', () => reject(signal.reason))) }
  const a = pool.run('spanish:word', new AbortController().signal, create)
  const b = pool.run('arabic:word', new AbortController().signal, create)
  await Promise.resolve()
  expect(signals).toHaveLength(2)
  pool.clear()
  await expect(a).rejects.toMatchObject({name:'AbortError'})
  await expect(b).rejects.toMatchObject({name:'AbortError'})
  await expect(pool.run('spanish:word', new AbortController().signal, async () => 'new workspace')).resolves.toBe('new workspace')
})
