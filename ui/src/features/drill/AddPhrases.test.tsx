// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../components/localization/i18n'
import { AddPhrases } from './AddPhrases'
import type { DrillCandidate, DrillGenerationPreview } from '../../generated/contracts'

const api = vi.hoisted(() => ({
  previewDrillItems: vi.fn(), acceptDrillItems: vi.fn(), discardDrillPreview: vi.fn(),
  conversationDrillCandidates: vi.fn(), getDrillPreview: vi.fn(), drillGenerationActivity: vi.fn(),
  beginDrillPreview: vi.fn(), runDrillPreview: vi.fn(), cancelDrillPreview: vi.fn(),
}))
vi.mock('../../platform/ipc/drill-generation', () => api)
vi.mock('../../platform/diagnostics/faults', () => ({ reportFault: vi.fn() }))

const scope = { language: 'spanish', variety: 'spanish-spain', explanation: 'english', explanationVariety: 'english-us' }
const candidate = (overrides: Partial<DrillCandidate> = {}): DrillCandidate => ({
  candidateId: 'candidate-1', text: 'Un café, por favor.', translation: 'A coffee, please.',
  reported: { difficulty: 'beginner', tags: [] },
  verified: { scopeMatchesRequest: true, lengthOk: true, nonEmpty: true, duplicate: false },
  source: { kind: 'generated', requestId: 'request-1', candidateId: 'candidate-1', topic: null, difficulty: 'beginner', length: 'shortPhrase' },
  ...overrides,
} as DrillCandidate)
const preview = (overrides: Partial<DrillGenerationPreview> = {}): DrillGenerationPreview => ({
  requestId: 'request-1', receiptId: 'receipt-1', shortfall: null,
  requested: { ...scope, topic: null, count: 2, difficulty: 'beginner', length: 'shortPhrase' },
  candidates: [candidate(), candidate({ candidateId: 'candidate-2', text: 'La cuenta, por favor.', translation: 'The bill, please.' })],
  ...overrides,
} as DrillGenerationPreview)

beforeEach(() => {
  vi.resetAllMocks()
  api.previewDrillItems.mockResolvedValue(preview())
  api.acceptDrillItems.mockResolvedValue([])
  api.discardDrillPreview.mockResolvedValue(undefined)
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
const open = (onAdded = vi.fn(async () => {})) => {
  render(<I18nProvider locale="english"><AddPhrases scope={scope} onAdded={onAdded} onClose={vi.fn()} /></I18nProvider>)
  return onAdded
}

it('never generates until asked, then sends length and difficulty as separate choices', async () => {
  open()
  expect(fetchCalls()).toBe(0)
  fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 'ordering coffee' } })
  fireEvent.change(screen.getByLabelText('Length'), { target: { value: 'severalSentences' } })
  fireEvent.change(screen.getByLabelText('Difficulty'), { target: { value: 'advanced' } })
  fireEvent.change(screen.getByLabelText('How many'), { target: { value: '3' } })
  // Changing controls must not start work.
  expect(fetchCalls()).toBe(0)
  fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
  await waitFor(() => expect(api.previewDrillItems).toHaveBeenCalledWith(
    { ...scope, topic: 'ordering coffee', count: 3, difficulty: 'advanced', length: 'severalSentences' },
    expect.any(AbortSignal)))
})

it('refuses a quantity outside the supported range before any request', async () => {
  open()
  fireEvent.change(screen.getByLabelText('How many'), { target: { value: '99' } })
  expect(await screen.findByRole('alert')).toHaveTextContent('Ask for between 1 and 20 phrases.')
  expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled()
  expect(fetchCalls()).toBe(0)
})

it('adopts only the chosen candidates, by native id', async () => {
  const added = open()
  fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
  const list = await screen.findByRole('list')
  const boxes = within(list).getAllByRole('checkbox')
  fireEvent.click(boxes[1])
  fireEvent.click(screen.getByRole('button', { name: 'Add 1 to practice' }))
  await waitFor(() => expect(api.acceptDrillItems).toHaveBeenCalledWith('request-1', ['candidate-2']))
  await waitFor(() => expect(added).toHaveBeenCalledOnce())
  // What was adopted says so, and cannot be adopted twice.
  expect(await within(list).findByText('Added')).toBeVisible()
  expect(boxes[1]).toBeDisabled()
})

it('captions a preview with what was asked for, not with the controls as they stand now', async () => {
  open()
  fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
  expect(await screen.findByText('Asked for 2 × short phrase at beginner.')).toBeVisible()
  // Moving a control afterwards must not rewrite the answer's caption.
  fireEvent.change(screen.getByLabelText('Length'), { target: { value: 'word' } })
  expect(screen.getByText('Asked for 2 × short phrase at beginner.')).toBeVisible()
})

it('states a shortfall instead of quietly refilling it', async () => {
  api.previewDrillItems.mockResolvedValue(preview({
    candidates: [candidate()], shortfall: { requested: 2, produced: 1, reason: 'one candidate was over the length limit' },
  }))
  open()
  fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
  expect(await screen.findByText(/Asked for 2, got 1/)).toBeVisible()
  expect(api.previewDrillItems).toHaveBeenCalledOnce()
})

it('marks a phrase already in practice and refuses to add it again', async () => {
  api.previewDrillItems.mockResolvedValue(preview({
    candidates: [candidate({ verified: { scopeMatchesRequest: true, lengthOk: true, nonEmpty: true, duplicate: true } })],
  }))
  open()
  fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
  expect(await screen.findByText('Already in your phrases')).toBeVisible()
  expect(screen.getByRole('checkbox')).toBeDisabled()
})

it('reads lines out of past chats without any generation request', async () => {
  api.conversationDrillCandidates.mockResolvedValue({
    preview: preview({ requestId: 'conversation-1', requested: null, receiptId: null,
      candidates: [candidate({ candidateId: 'span-1', text: '¿Dónde está el baño?', translation: null,
        reported: { difficulty: null, tags: [] },
        source: { kind: 'conversation', revision: '3',
          sourceRef: { conversationId: 'conversation-a', messageId: 'message-1', turnId: 'turn-1', role: 'assistant', startByte: 0, endByte: 21 } } })] }),
    nextCursor: null,
  })
  open()
  fireEvent.click(screen.getByRole('radio', { name: 'From your chats' }))
  fireEvent.click(screen.getByRole('button', { name: 'Find lines' }))
  expect(await screen.findByText('¿Dónde está el baño?')).toBeVisible()
  expect(screen.getByText('Taken from your chats, exactly as written there.')).toBeVisible()
  expect(api.previewDrillItems).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Add 1 to practice' }))
  await waitFor(() => expect(api.acceptDrillItems).toHaveBeenCalledWith('conversation-1', ['span-1']))
})

it('switching source abandons the previous offer rather than mixing the two', async () => {
  open()
  fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
  await screen.findByText('Un café, por favor.')
  api.conversationDrillCandidates.mockResolvedValue({ preview: preview({ requestId: 'conversation-1', candidates: [] }), nextCursor: null })
  fireEvent.click(screen.getByRole('radio', { name: 'From your chats' }))
  expect(screen.queryByText('Un café, por favor.')).not.toBeInTheDocument()
})

function fetchCalls() {
  return api.previewDrillItems.mock.calls.length + api.conversationDrillCandidates.mock.calls.length
}
