// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../components/localization/i18n'
import { AddPhrases } from './AddPhrases'
import type { DrillCandidate, DrillGenerationPreview } from '../../generated/contracts'

const profiles = vi.hoisted(() => ({ getLearnerProfile: vi.fn() }))
vi.mock('../../platform/ipc/learner-profile', () => profiles)

const api = vi.hoisted(() => ({
  previewDrillItems: vi.fn(), acceptDrillItems: vi.fn(), discardDrillPreview: vi.fn(),
  conversationDrillCandidates: vi.fn(), getDrillPreview: vi.fn(), drillGenerationActivity: vi.fn(),
  beginDrillPreview: vi.fn(), runDrillPreview: vi.fn(), cancelDrillPreview: vi.fn(),
}))
vi.mock('../../platform/ipc/drill-generation', () => api)
vi.mock('../../platform/diagnostics/faults', () => ({ reportFault: vi.fn() }))
vi.mock('../../platform/ipc/tauri', () => ({
  languageFor: () => ({ languageTag: 'es', direction: 'ltr', romanization: null }),
  languages: () => [],
  isTauri: true,
}))

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
const open = (onAdded = vi.fn(async () => {}), onClose = vi.fn()) => {
  render(<I18nProvider locale="english"><AddPhrases scope={scope} onAdded={onAdded} onClose={onClose} /></I18nProvider>)
  return onAdded
}
const generate = () => fireEvent.click(screen.getByRole('button', { name: 'Generate' }))

it('labels a nested rate limit and retries only the failed part of the saved batch', async () => {
  api.previewDrillItems.mockResolvedValueOnce(preview())
    .mockRejectedValueOnce({message:'Generation failed',diagnostics:{response:{choices:[{error:{code:429,message:'Temporarily limited'}}]}}})
    .mockResolvedValueOnce(preview({requestId:'retried',candidates:[candidate({candidateId:'retried-phrase'})]}))
  open()
  fireEvent.click(screen.getByRole('checkbox', {name:'Word'}))
  generate()
  await screen.findByRole('button', {name:'Retry'})
  expect(screen.getByRole('alert')).toHaveTextContent('Sorry, rate limited. Try again shortly.')
  expect(api.previewDrillItems).toHaveBeenCalledTimes(2)
  fireEvent.change(screen.getByLabelText('Topic (optional)'), {target:{value:'different topic'}})
  fireEvent.click(screen.getByRole('button', {name:'Retry'}))
  await waitFor(() => expect(api.previewDrillItems).toHaveBeenCalledTimes(3))
  expect(api.previewDrillItems.mock.calls[2][0]).toEqual(api.previewDrillItems.mock.calls[1][0])
  expect(api.previewDrillItems.mock.calls[2][0].length).toBe('shortPhrase')
  expect(screen.queryByRole('alert')).toBeNull()
})

it('never generates until asked, then sends length and difficulty as separate choices', async () => {
  open()
  expect(fetchCalls()).toBe(0)
  fireEvent.change(screen.getByLabelText('Topic (optional)'), { target: { value: 'ordering coffee' } })
  fireEvent.click(screen.getByRole('checkbox', { name: 'Short phrase' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Several sentences' }))
  fireEvent.change(screen.getByLabelText('Difficulty'), { target: { value: 'advanced' } })
  fireEvent.change(screen.getByLabelText('How many'), { target: { value: '3' } })
  // Changing controls must not start work.
  expect(fetchCalls()).toBe(0)
  generate()
  await waitFor(() => expect(api.previewDrillItems).toHaveBeenCalledWith(
    { ...scope, topic: 'ordering coffee', count: 3, difficulty: 'advanced', length: 'severalSentences' },
    expect.any(AbortSignal)))
  expect(api.previewDrillItems).toHaveBeenCalledOnce()
})

it('asks once per ticked length, sharing the quantity out between them', async () => {
  open()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Word' }))
  fireEvent.change(screen.getByLabelText('How many'), { target: { value: '3' } })
  generate()
  // The contract carries one length per request, and the list keeps the
  // contract's order, so word comes first and takes the odd phrase.
  await waitFor(() => expect(api.previewDrillItems).toHaveBeenCalledTimes(2))
  expect(api.previewDrillItems.mock.calls.map(call => [call[0].length, call[0].count]))
    .toEqual([['word', 2], ['shortPhrase', 1]])
})

it('refuses a quantity outside the supported range before any request', async () => {
  open()
  fireEvent.change(screen.getByLabelText('How many'), { target: { value: '99' } })
  expect(await screen.findByRole('alert')).toHaveTextContent('Ask for between 1 and 20 phrases.')
  expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled()
  expect(fetchCalls()).toBe(0)
})

it('refuses an ask with nothing ticked', () => {
  open()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Short phrase' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Pick at least one thing to add.')
  expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled()
  expect(fetchCalls()).toBe(0)
})

it('keeps one phrase per press, by native id, with no confirm step', async () => {
  const added = open()
  generate()
  fireEvent.click(await screen.findByRole('button', { name: 'Keep “La cuenta, por favor.”' }))
  await waitFor(() => expect(api.acceptDrillItems).toHaveBeenCalledWith('request-1', ['candidate-2']))
  await waitFor(() => expect(added).toHaveBeenCalledOnce())
  // What was kept says so, and its control is gone rather than merely disabled.
  expect(await screen.findByText('Added')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Keep “La cuenta, por favor.”' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Keep “Un café, por favor.”' })).toBeVisible()
})

it('keeps every remaining phrase in one press', async () => {
  open()
  generate()
  fireEvent.click(await screen.findByRole('button', { name: 'Keep all 2' }))
  await waitFor(() => expect(api.acceptDrillItems).toHaveBeenCalledWith('request-1', ['candidate-1', 'candidate-2']))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Keep all 2' })).not.toBeInTheDocument())
})

it('gives back whatever was not kept when the dialog closes', async () => {
  const onClose = vi.fn()
  render(<I18nProvider locale="english"><AddPhrases scope={scope} onAdded={vi.fn(async () => {})} onClose={onClose} /></I18nProvider>)
  generate()
  await screen.findByText('Un café, por favor.')
  fireEvent.click(screen.getByRole('button', { name: 'Close Add phrases' }))
  expect(api.discardDrillPreview).toHaveBeenCalledWith('request-1')
  expect(onClose).toHaveBeenCalledOnce()
})

it('captions a preview with what was asked for, not with the controls as they stand now', async () => {
  open()
  generate()
  expect(await screen.findByText('Asked for 2 × short phrase at beginner.')).toBeVisible()
  // Moving a control afterwards must not rewrite the answer's caption.
  fireEvent.click(screen.getByRole('checkbox', { name: 'Word' }))
  expect(screen.getByText('Asked for 2 × short phrase at beginner.')).toBeVisible()
})

it('states a shortfall instead of quietly refilling it', async () => {
  api.previewDrillItems.mockResolvedValue(preview({
    candidates: [candidate()], shortfall: { requested: 2, produced: 1, reason: 'one candidate was over the length limit' },
  }))
  open()
  generate()
  expect(await screen.findByText(/Asked for 2, got 1/)).toBeVisible()
  expect(api.previewDrillItems).toHaveBeenCalledOnce()
})

it('marks a phrase already in practice and refuses to add it again', async () => {
  api.previewDrillItems.mockResolvedValue(preview({
    candidates: [candidate({ verified: { scopeMatchesRequest: true, lengthOk: true, nonEmpty: true, duplicate: true } })],
  }))
  open()
  generate()
  expect(await screen.findByText('Already in your phrases')).toBeVisible()
  expect(screen.queryByRole('button', { name: /^Keep/ })).not.toBeInTheDocument()
})

it('reads lines out of past chats without any generation request', async () => {
  api.conversationDrillCandidates.mockResolvedValue({ preview: conversationPreview(), nextCursor: null })
  open()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Short phrase' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Lines from your chats' }))
  generate()
  expect(await screen.findByText('¿Dónde está el baño?')).toBeVisible()
  expect(screen.getByText('Taken from your chats, exactly as written there.')).toBeVisible()
  expect(api.previewDrillItems).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Keep “¿Dónde está el baño?”' }))
  await waitFor(() => expect(api.acceptDrillItems).toHaveBeenCalledWith('conversation-1', ['span-1']))
})

it('offers written phrases and chat lines together when both are ticked', async () => {
  api.conversationDrillCandidates.mockResolvedValue({ preview: conversationPreview(), nextCursor: null })
  open()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Lines from your chats' }))
  generate()
  expect(await screen.findByText('¿Dónde está el baño?')).toBeVisible()
  expect(screen.getByText('Un café, por favor.')).toBeVisible()
  // Each source is captioned as what it is, rather than one standing for both.
  expect(screen.getByText('Asked for 2 × short phrase at beginner.')).toBeVisible()
  expect(screen.getByText('Taken from your chats, exactly as written there.')).toBeVisible()
})

function conversationPreview(): DrillGenerationPreview {
  return preview({
    requestId: 'conversation-1', requested: null, receiptId: null,
    candidates: [candidate({
      candidateId: 'span-1', text: '¿Dónde está el baño?', translation: null,
      reported: { difficulty: null, tags: [] },
      source: { kind: 'conversation', revision: '3',
        sourceRef: { conversationId: 'conversation-a', messageId: 'message-1', turnId: 'turn-1', role: 'assistant', startByte: 0, endByte: 21 } },
    })],
  })
}

function fetchCalls() {
  return api.previewDrillItems.mock.calls.length + api.conversationDrillCandidates.mock.calls.length
}

it('sends a selected skill only after Generate and keeps the length choice', async () => {
  profiles.getLearnerProfile.mockResolvedValue({ evidence: { catalog: [{id:'past_reference',label:'Refer to the past',kind:'skill'},{id:'root',label:'Root',kind:'root'}] } })
  open()
  fireEvent.change(screen.getByLabelText('Skill focus'), { target: { value: 'skill' } })
  expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled()
  await screen.findByRole('option', { name: 'Refer to the past' })
  fireEvent.change(screen.getByLabelText('Skills'), { target: { value: 'past_reference' } })
  expect(fetchCalls()).toBe(0)
  generate()
  await waitFor(() => expect(api.previewDrillItems).toHaveBeenCalledWith(expect.objectContaining({skillTarget:{kind:'skill',skillId:'past_reference'},length:'shortPhrase'}),expect.any(AbortSignal)))
})
it('sends coach mode through the normal preview request without evaluating skills in the UI', async () => {
  open()
  fireEvent.change(screen.getByLabelText('Skill focus'), { target: { value: 'explore' } })
  expect(fetchCalls()).toBe(0)
  expect(profiles.getLearnerProfile).not.toHaveBeenCalled()
  generate()
  await waitFor(() => expect(api.previewDrillItems).toHaveBeenCalledWith(expect.objectContaining({skillTarget:{kind:'coach',mode:'explore'}}),expect.any(AbortSignal)))
})
