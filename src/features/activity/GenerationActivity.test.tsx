// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { PersonaGenerationActivity, PersonaGenerationAttempt } from '../../contracts'
import { GenerationActivity } from './GenerationActivity'

const api = vi.hoisted(() => ({ read: vi.fn() }))
vi.mock('../../platform/ipc/workspace', () => ({ readPersonaGenerationActivity: api.read, nativeError: String }))

const attempt: PersonaGenerationAttempt = {
  id: 'generation-id', attemptId: 'attempt-id', operationId: 'operation-id', languageId: 'es',
  route: 'custom', requestedModel: 'requested-model', profileRevision: 4, state: 'failed',
  createdAt: '2026-09-12T12:00:00Z', dispatchedAt: '2026-09-12T12:00:01Z', finishedAt: '2026-09-12T12:00:02Z',
  actualModel: 'actual-model', providerId: 'provider-request-id', inputTokens: null, outputTokens: null, error: 'Provider request failed',
}
const snapshot = (revision = 1): PersonaGenerationActivity => ({
  revision, attempts: [attempt], usage: { attempts: 8, inputTokens: 120, outputTokens: 45, unknownUsage: 2 },
})
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}
const flush = async () => { await act(async () => {}) }
beforeEach(() => { vi.useFakeTimers(); api.read.mockReset() })
afterEach(() => { vi.useRealTimers() })

it('renders global dispatched usage and inspectable IDs without inventing missing usage', async () => {
  api.read.mockResolvedValue(snapshot())
  render(<GenerationActivity />)
  await flush()
  expect(screen.getByText('Persona generation · Global')).toBeInTheDocument()
  expect(screen.getByRole('table')).toHaveAccessibleName('All retained dispatched attempts')
  expect(screen.getByRole('row', { name: 'Attempts 8' })).toBeInTheDocument()
  expect(screen.getByRole('row', { name: 'Reported input tokens 120' })).toBeInTheDocument()
  expect(screen.getByRole('row', { name: 'Attempts with unknown usage 2' })).toBeInTheDocument()
  fireEvent.click(screen.getByText('failed · es · 2026-09-12T12:00:00Z'))
  expect(screen.getByText('generation-id')).toBeInTheDocument()
  expect(screen.getByText('attempt-id')).toBeInTheDocument()
  expect(screen.getByText('operation-id')).toBeInTheDocument()
  expect(screen.getByText('provider-request-id')).toBeInTheDocument()
  expect(screen.getByText('— / —')).toBeInTheDocument()
  expect(screen.getByText('Provider request failed')).toBeInTheDocument()
  expect(api.read).toHaveBeenCalledExactlyOnceWith()
})

it('serializes slow polling and adopts the next native revision', async () => {
  const first = deferred<PersonaGenerationActivity>()
  const second = deferred<PersonaGenerationActivity>()
  api.read.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
  render(<GenerationActivity />)
  await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
  expect(api.read).toHaveBeenCalledOnce()
  await act(async () => first.resolve(snapshot()))
  await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
  expect(api.read).toHaveBeenCalledTimes(2)
  await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
  expect(api.read).toHaveBeenCalledTimes(2)
  await act(async () => second.resolve({ ...snapshot(2), attempts: [{ ...attempt, state: 'succeeded', error: null, inputTokens: 10, outputTokens: 5 }] }))
  expect(screen.getByText('succeeded · es · 2026-09-12T12:00:00Z')).toBeInTheDocument()
})

it('shows a poll failure, removes stale totals, and requires explicit retry', async () => {
  api.read.mockResolvedValueOnce(snapshot()).mockRejectedValueOnce(new Error('Receipt storage unavailable'))
  render(<GenerationActivity />)
  await flush()
  await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
  expect(screen.getByRole('alert')).toHaveTextContent('Receipt storage unavailable')
  expect(screen.queryByRole('table')).toBeNull()
  await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
  expect(api.read).toHaveBeenCalledTimes(2)
  api.read.mockResolvedValueOnce({ revision: 3, attempts: [], usage: { attempts: 0, inputTokens: 0, outputTokens: 0, unknownUsage: 0 } })
  fireEvent.click(screen.getByRole('button', { name: 'Retry generation activity' }))
  await flush()
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.getByText('No recorded persona generations.')).toBeInTheDocument()
})

it.each(['resolve', 'reject'] as const)('ignores an unmounted read that later %ss and does not poll again', async (settle) => {
  const old = deferred<PersonaGenerationActivity>()
  api.read.mockReturnValueOnce(old.promise).mockResolvedValueOnce(snapshot(2))
  const view = render(<GenerationActivity />)
  view.unmount()
  render(<GenerationActivity />)
  await flush()
  await act(async () => { if (settle === 'resolve') old.resolve({ ...snapshot(), attempts: [] }); else old.reject(new Error('Obsolete failure')) })
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.queryByText('No recorded persona generations.')).toBeNull()
  expect(screen.getByText('failed · es · 2026-09-12T12:00:00Z')).toBeInTheDocument()
  expect(api.read).toHaveBeenCalledTimes(2)
})

it('limits rendered receipts to 50 while keeping native aggregate totals', async () => {
  api.read.mockResolvedValue({ ...snapshot(), attempts: Array.from({ length: 60 }, (_, index) => ({ ...attempt, id: `generation-${index}` })) })
  const view = render(<GenerationActivity />)
  await flush()
  expect(view.container.querySelectorAll('details > details')).toHaveLength(50)
  expect(within(screen.getByRole('table')).getByRole('row', { name: 'Attempts 8' })).toBeInTheDocument()
})
