// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../components/localization/i18n'
import { AddPhrases } from './AddPhrases'
import { ReadingLookupContext } from '../../components/reading/ReadingContext'
import type { DrillCandidate, DrillGenerationPreview } from '../../generated/contracts'

const profiles = vi.hoisted(() => ({ getLearnerProfile: vi.fn() }))
vi.mock('../../platform/ipc/learner-profile', () => profiles)

const api = vi.hoisted(() => ({
  previewDrillItems: vi.fn(), acceptDrillItems: vi.fn(), discardDrillPreview: vi.fn(),
  conversationDrillCandidates: vi.fn(), getDrillPreview: vi.fn(), drillGenerationActivity: vi.fn(),
  beginDrillPreview: vi.fn(), runDrillPreview: vi.fn(), cancelDrillPreview: vi.fn(),
}))
vi.mock('../../platform/ipc/drill-generation', () => api)
const bundled = vi.hoisted(() => ({ getPracticeSets: vi.fn(), previewPracticeSet: vi.fn(), acceptPracticePhrases: vi.fn() }))
vi.mock('../../platform/ipc/practice-sets', () => bundled)
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
  bundled.getPracticeSets.mockResolvedValue(['absolute_zero', 'beginner', 'intermediate', 'advanced', 'social', 'idiomatic']
    .map(set => ({ set, count: set === 'social' ? 15 : 8, sample: 'Texto.' })))
  profiles.getLearnerProfile.mockResolvedValue({ evidence: { catalog: [] } })
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

it('starts all bulk lookups before any complete and cancels them together', async () => {
  const signals: AbortSignal[] = []
  const read = vi.fn((_: unknown, signal: AbortSignal) => {
    signals.push(signal)
    return new Promise<never>((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), {once:true}))
  })
  const candidates = Array.from({length:8}, (_, index) => candidate({candidateId:`parallel-${index}`,text:`Phrase ${index}`,translation:null}))
  render(<I18nProvider locale="english"><ReadingLookupContext value={read}>
    <AddPhrases scope={scope} initialPreview={preview({candidates})} onAdded={vi.fn(async () => {})} onClose={vi.fn()} />
  </ReadingLookupContext></I18nProvider>)
  fireEvent.click(screen.getByRole('checkbox',{name:'Show all translations'}))
  await waitFor(() => expect(read).toHaveBeenCalledTimes(8))
  fireEvent.click(screen.getByRole('checkbox',{name:'Show all pronunciations / romanizations'}))
  await waitFor(() => expect(read).toHaveBeenCalledTimes(16))
  fireEvent.click(screen.getByRole('checkbox',{name:'Show all translations'}))
  expect(signals.slice(0,8).every(signal => signal.aborted)).toBe(true)
  expect(signals.slice(8).every(signal => !signal.aborted)).toBe(true)
  fireEvent.click(screen.getByRole('checkbox',{name:'Show all pronunciations / romanizations'}))
  expect(signals.every(signal => signal.aborted)).toBe(true)
})

it('makes the open phrase disclosure neutral and restores blue when closed', async () => {
  open()
  const summary = screen.getByText('Show pre-generated phrases')
  expect(summary).toHaveClass('outline')
  fireEvent.click(summary)
  await waitFor(() => expect(summary).not.toHaveClass('outline'))
  fireEvent.click(summary)
  await waitFor(() => expect(summary).toHaveClass('outline'))
})

it('shows bulk aids for the picker, reuses supplied translations and resets on reopening', async () => {
  const read = vi.fn().mockImplementation(async (input: {text:string}) => ({gloss:{coverage:'complete',segments:[
    {start:0,end:input.text.length,kind:'gloss',gloss:'meaning',pronunciation:'sound of '+input.text},
  ]}}))
  const source = () => <I18nProvider locale="english"><ReadingLookupContext value={read}>
    <AddPhrases scope={scope} initialPreview={preview()} onAdded={vi.fn(async () => {})} onClose={vi.fn()} />
  </ReadingLookupContext></I18nProvider>
  const view = render(source())
  expect(read).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('checkbox',{name:'Show all translations'}))
  expect(screen.getByText('A coffee, please.')).toBeVisible()
  expect(screen.getByText('The bill, please.')).toBeVisible()
  expect(read).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('checkbox',{name:'Show all pronunciations / romanizations'}))
  expect(await screen.findByText('sound of Un café, por favor.')).toBeVisible()
  expect(await screen.findByText('sound of La cuenta, por favor.')).toBeVisible()
  fireEvent.click(screen.getByRole('checkbox',{name:'Show all pronunciations / romanizations'}))
  expect(screen.queryByText('sound of Un café, por favor.')).toBeNull()
  view.unmount()
  render(source())
  expect(screen.getByRole('checkbox',{name:'Show all translations'})).not.toBeChecked()
  expect(screen.getByRole('checkbox',{name:'Show all pronunciations / romanizations'})).not.toBeChecked()
})

it.each(['social', 'idiomatic'] as const)('appends %s candidates beside generated candidates and saves only after Keep', async set => {
  const label = set === 'social' ? 'Add 15 social phrases' : 'Add 8 idiomatic phrases'
  const text = set === 'social' ? '¡Hola!' : 'No tires la toalla.'
  bundled.previewPracticeSet.mockResolvedValue(preview({ requestId: `bundled:${set}`, requested: null, candidates: [
    candidate({ candidateId: 'authored-1', text, source: { kind: 'bundled', set, contentHash: 'fixture' } }),
  ] }))
  bundled.acceptPracticePhrases.mockResolvedValue([{ id: 'kept-social' }])
  const onAdded = open()
  expect(screen.queryByRole('button', { name: label })).toBeNull()
  fireEvent.click(screen.getByText('Show pre-generated phrases'))
  generate()
  await screen.findByRole('button', { name: 'Keep “Un café, por favor.”' })
  fireEvent.click(await screen.findByRole('button', { name: label }))
  const keep = await screen.findByRole('button', { name: `Keep “${text}”` })
  expect(onAdded).not.toHaveBeenCalled()
  expect(bundled.acceptPracticePhrases).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Keep “Un café, por favor.”' })).toBeVisible()
  expect(screen.queryByText('Included phrases')).toBeNull()
  expect(screen.queryByText('Ready to add. No generation needed.')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: label }))
  await waitFor(() => expect(bundled.previewPracticeSet).toHaveBeenCalledTimes(2))
  expect(screen.getAllByRole('button', { name: `Keep “${text}”` })).toHaveLength(1)
  fireEvent.click(keep)
  await waitFor(() => expect(onAdded).toHaveBeenCalledOnce())
  expect(bundled.acceptPracticePhrases).toHaveBeenCalledWith(scope, set, `bundled:${set}`, ['authored-1'])
  expect(api.acceptDrillItems).not.toHaveBeenCalled()
  expect(screen.queryByText('Taken from your conversations, exactly as written there.')).toBeNull()
})

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

it('shows the results well before anything is asked', () => {
  open()
  expect(screen.getByText('Generated phrases will appear here.')).toBeVisible()
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
  api.previewDrillItems.mockImplementation(async input => {
    const requestId = `request-${input.length}`
    return preview({
      requestId, receiptId: `receipt-${input.length}`, requested: input,
      candidates: Array.from({ length: input.count }, (_, index) => {
        const candidateId = `${requestId}-${index}`
        return candidate({ candidateId, source: {
          kind: 'generated', requestId, candidateId, topic: input.topic,
          difficulty: input.difficulty, length: input.length,
        } })
      }),
    })
  })
  open()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Word' }))
  fireEvent.change(screen.getByLabelText('How many'), { target: { value: '3' } })
  generate()
  // The contract carries one length per request, and the list keeps the
  // contract's order, so word comes first and takes the odd phrase.
  await waitFor(() => expect(api.previewDrillItems).toHaveBeenCalledTimes(2))
  expect(api.previewDrillItems.mock.calls.map(call => [call[0].length, call[0].count]))
    .toEqual([['word', 2], ['shortPhrase', 1]])
  expect(await screen.findByRole('button', { name: 'Keep all 3' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Keep all 3' }))
  await waitFor(() => expect(api.acceptDrillItems).toHaveBeenCalledTimes(2))
  expect(api.acceptDrillItems).toHaveBeenCalledWith('request-word', ['request-word-0', 'request-word-1'])
  expect(api.acceptDrillItems).toHaveBeenCalledWith('request-shortPhrase', ['request-shortPhrase-0'])
})

it('refuses a quantity outside the supported range before any request', async () => {
  open()
  fireEvent.change(screen.getByLabelText('How many'), { target: { value: '99' } })
  expect(await screen.findByRole('alert')).toHaveTextContent('Choose between 1 and 20 practice cards to generate.')
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

it('keeps a phrase with the icon-only Add to Practice control, explained once above the results', async () => {
  open()
  expect(document.querySelector('.drill-hint')).toBeNull()
  generate()
  const keep = await screen.findByRole('button', { name: 'Keep “Un café, por favor.”' })
  // The same square icon control as a message's Add to Practice: no word to wrap.
  expect(keep).toHaveClass('message-add-drill')
  expect(keep.textContent).toBe('')
  const hints = document.querySelectorAll('.drill-hint')
  expect(hints).toHaveLength(1)
  expect(hints[0]).toHaveTextContent('Click to add a phrase to your practice cards.')
  expect(within(hints[0] as HTMLElement).getByRole('img', { name: 'Add to Practice' })).toBeInTheDocument()
  expect(hints[0].parentElement).toBe(screen.getByRole('button', { name: 'Keep all 2' }).parentElement)
  // The hint leads the list it explains.
  expect(hints[0].compareDocumentPosition(keep) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

it('keeps every remaining phrase in one press', async () => {
  open()
  generate()
  fireEvent.click(await screen.findByRole('button', { name: 'Keep all 2' }))
  await waitFor(() => expect(api.acceptDrillItems).toHaveBeenCalledWith('request-1', ['candidate-1', 'candidate-2']))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Keep all 2' })).not.toBeInTheDocument())
})

it('clears generated and bundled candidates without closing or undoing kept cards', async () => {
  bundled.previewPracticeSet.mockResolvedValue(preview({requestId:'bundled:social',requested:null,candidates:[
    candidate({candidateId:'local-1',text:'¡Hola!',source:{kind:'bundled',set:'social',contentHash:'fixture'}}),
  ]}))
  const onClose = vi.fn()
  const onAdded = open(vi.fn(async () => {}), onClose)
  generate()
  fireEvent.click(await screen.findByRole('button',{name:'Keep “Un café, por favor.”'}))
  await waitFor(() => expect(onAdded).toHaveBeenCalledOnce())
  fireEvent.click(screen.getByText('Show pre-generated phrases'))
  fireEvent.click(await screen.findByRole('button',{name:'Add 15 social phrases'}))
  await screen.findByRole('button',{name:'Keep “¡Hola!”'})
  fireEvent.click(screen.getByRole('button',{name:'Clear all'}))
  expect(screen.getByText('Generated phrases will appear here.')).toBeVisible()
  expect(screen.queryByText('Un café, por favor.')).toBeNull()
  expect(screen.queryByText('¡Hola!')).toBeNull()
  expect(api.discardDrillPreview.mock.calls).toEqual([['request-1']])
  expect(api.acceptDrillItems).toHaveBeenCalledOnce()
  expect(bundled.acceptPracticePhrases).not.toHaveBeenCalled()
  expect(onClose).not.toHaveBeenCalled()
  expect(screen.getByRole('button',{name:'Generate'})).toBeEnabled()
})

it('gives back whatever was not kept when the dialog closes', async () => {
  const onClose = vi.fn()
  render(<I18nProvider locale="english"><AddPhrases scope={scope} onAdded={vi.fn(async () => {})} onClose={onClose} /></I18nProvider>)
  generate()
  await screen.findByText('Un café, por favor.')
  fireEvent.click(screen.getByRole('button', { name: 'Close Add practice cards' }))
  expect(api.discardDrillPreview).toHaveBeenCalledWith('request-1')
  expect(onClose).toHaveBeenCalledOnce()
})

it('captions a preview with what was asked for, not with the controls as they stand now', async () => {
  open()
  generate()
  expect(await screen.findByText('Generated 2 × short phrase at beginner.')).toBeVisible()
  // Moving a control afterwards must not rewrite the answer's caption.
  fireEvent.click(screen.getByRole('checkbox', { name: 'Word' }))
  expect(screen.getByText('Generated 2 × short phrase at beginner.')).toBeVisible()
})

it('states a shortfall instead of quietly refilling it', async () => {
  api.previewDrillItems.mockResolvedValue(preview({
    candidates: [candidate()], shortfall: { requested: 2, produced: 1, reason: 'one candidate was over the length limit' },
  }))
  open()
  generate()
  expect(await screen.findByText(/Generated 1 of 2 practice cards/)).toBeVisible()
  expect(api.previewDrillItems).toHaveBeenCalledOnce()
})

it('marks a phrase already in practice and refuses to add it again', async () => {
  api.previewDrillItems.mockResolvedValue(preview({
    candidates: [candidate({ verified: { scopeMatchesRequest: true, lengthOk: true, nonEmpty: true, duplicate: true } })],
  }))
  open()
  generate()
  expect(await screen.findByText('Already in your practice cards')).toBeVisible()
  expect(screen.queryByRole('button', { name: /^Keep/ })).not.toBeInTheDocument()
})

it('reads lines out of past chats without any generation request', async () => {
  api.conversationDrillCandidates.mockResolvedValue({ preview: conversationPreview(), nextCursor: null })
  open()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Short phrase' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Lines from your conversations' }))
  generate()
  expect(await screen.findByText('¿Dónde está el baño?')).toBeVisible()
  expect(screen.queryByText('Taken from your conversations, exactly as written there.')).toBeNull()
  expect(screen.queryByText(/Generated 1 of 20 practice cards/)).toBeNull()
  expect(api.previewDrillItems).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Keep “¿Dónde está el baño?”' }))
  await waitFor(() => expect(api.acceptDrillItems).toHaveBeenCalledWith('conversation-1', ['span-1']))
})

it('offers written phrases and chat lines together when both are ticked', async () => {
  api.conversationDrillCandidates.mockResolvedValue({ preview: conversationPreview(), nextCursor: null })
  open()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Lines from your conversations' }))
  generate()
  expect(await screen.findByText('¿Dónde está el baño?')).toBeVisible()
  expect(screen.getByText('Un café, por favor.')).toBeVisible()
  // Only the paid generation has a request caption.
  expect(screen.getByText('Generated 2 × short phrase at beginner.')).toBeVisible()
  expect(screen.queryByText('Taken from your conversations, exactly as written there.')).toBeNull()
})

function conversationPreview(): DrillGenerationPreview {
  return preview({
    requestId: 'conversation-1', requested: null, receiptId: null,
    shortfall: { requested: 20, produced: 1, reason: 'Fewer usable, non-duplicate phrases were available. No automatic regeneration was attempted.' },
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
  await screen.findByRole('option', { name: 'Refer to the past' })
  fireEvent.change(screen.getByLabelText('Skill'), { target: { value: 'past_reference' } })
  expect(fetchCalls()).toBe(0)
  generate()
  await waitFor(() => expect(api.previewDrillItems).toHaveBeenCalledWith(expect.objectContaining({skillTarget:{kind:'skill',skillId:'past_reference'},length:'shortPhrase'}),expect.any(AbortSignal)))
})
it('omits skill focus when no skill is selected', async () => {
  open()
  generate()
  await waitFor(() => expect(api.previewDrillItems).toHaveBeenCalledOnce())
  expect(api.previewDrillItems.mock.calls[0][0]).not.toHaveProperty('skillTarget')
})
