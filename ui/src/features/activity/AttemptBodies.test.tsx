// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import type { AttemptView } from '../../generated/contracts'
import { useAttemptStreams } from '../../state/session/attempt-streams'
import { AttemptBodies } from './AttemptBodies'

const read = vi.hoisted(() => vi.fn())
vi.mock('../../platform/ipc/workspace', () => ({ readAttemptDetail: read, nativeError: String }))
beforeEach(() => { read.mockReset(); useAttemptStreams.getState().reset() })

it('keeps live response text in the inspector until the later retention commit arrives', async () => {
  const attempt: AttemptView = { id: 'a', operationId: 'o', state: 'cancelled', requestedModel: 'm', actualModel: null,
    providerId: null, startedAt: '', finishedAt: null, inputTokens: null, outputTokens: null, error: null, diagnostics: null, unpublishedText: 'Ho' }
  useAttemptStreams.getState().apply({ generation: 1, attemptId: 'a', conversationId: 'c', turnId: 't', operationId: 'o',
    kind: 'persona_reply', seq: 1, text: 'Hola mundo', terminal: 'cancelled' })
  read.mockResolvedValue({ requestMessages: null, responseText: null, previewText: 'Ho' })
  const view = render(<AttemptBodies attempt={attempt} />)
  await waitFor(() => expect(read).toHaveBeenCalledOnce())
  expect(screen.getByText('Hola mundo')).toBeInTheDocument()
  read.mockResolvedValue({ requestMessages: null, responseText: null, previewText: 'Hola mundo' })
  view.rerender(<AttemptBodies attempt={{ ...attempt, unpublishedText: 'Hola mundo' }} />)
  act(() => useAttemptStreams.getState().evict('a'))
  expect(screen.getByText('Hola mundo')).toBeInTheDocument()
  await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
})

it('shows retained content even when diagnostics redact it and exposes exact source', async () => {
  const attempt: AttemptView = { id: 'a', operationId: 'o', state: 'succeeded', requestedModel: 'm', actualModel: 'm',
    providerId: 'request', startedAt: '', finishedAt: '', inputTokens: 10, outputTokens: 4, error: null,
    diagnostics: { response: { content: '[redacted: content or credential]' } }, unpublishedText: null }
  const raw = JSON.stringify({ reply: '**Visible response**', value: 0 })
  read.mockResolvedValue({ requestMessages: [{ role: 'system', content: 'Visible request' }], responseText: raw, previewText: null })
  const view = render(<AttemptBodies attempt={attempt} />)
  expect(await screen.findByText('Visible request')).toBeInTheDocument()
  expect(screen.getByText('Visible response').closest('strong')).not.toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Source' }))
  await waitFor(() => expect(view.container.querySelector('.ai-response pre')?.textContent).toBe(raw))
})
