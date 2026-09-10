import { expect, it, vi } from 'vitest'
import { createTopicNotes } from './topic-notes'
const backend = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('./tauri', () => backend)
it('shares requests only within the same scoped resource and supports explicit retry', async () => {
  backend.invoke.mockResolvedValue({ explanation: 'Reason', example: 'porque', translation: 'because' })
  const resource = createTopicNotes()
  const request = { chatId: 'one', topic: 'reason', level: 'beginner' }
  expect(resource.read(request)).toBe(resource.read(request))
  await resource.read(request)
  expect(backend.invoke).toHaveBeenCalledTimes(1)
  await resource.read({ ...request, chatId: 'two' })
  expect(backend.invoke).toHaveBeenCalledTimes(2)
  resource.retry(request)
  await resource.read(request)
  expect(backend.invoke).toHaveBeenCalledTimes(3)
  await createTopicNotes().read(request)
  expect(backend.invoke).toHaveBeenCalledTimes(4)
})
it('notifies every subscriber through error and retry without duplicate synthesis', async () => {
  backend.invoke.mockReset().mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValue({ explanation: 'Ready', example: 'x', translation: 'y' })
  const resource = createTopicNotes()
  const request = { chatId: 'one', topic: 'reason', level: 'beginner' }
  const first = vi.fn(), second = vi.fn()
  const stopFirst = resource.subscribe(request, first), stopSecond = resource.subscribe(request, second)
  await expect(resource.read(request)).rejects.toThrow('Unavailable')
  expect(resource.snapshot(request).status).toBe('error')
  resource.retry(request)
  const retry = resource.read(request)
  expect(resource.read(request)).toBe(retry)
  await retry
  expect(resource.snapshot(request).status).toBe('ready')
  expect(first).toHaveBeenCalledTimes(second.mock.calls.length)
  expect(backend.invoke).toHaveBeenCalledTimes(2)
  stopFirst(); stopSecond()
})
