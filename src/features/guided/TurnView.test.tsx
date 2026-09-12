// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { TurnView, type TurnViewProps } from './TurnView'

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
})

function props(): TurnViewProps {
  const token = { text: 'Hola', gloss: 'Hello', pos: null, notable: false, romanization: null, pronunciation: null }
  return { turn: { id: 1, user: 'Hola', pendingText: '', assistant: { reply: 'Hola', tokens: [token], user_tokens: [token], translation: 'Partner translation', user_translation: 'Learner translation', mechanics: [], scaffolds: { replies: [], frames: [], starters: [] }, errors: [] } }, reviewing: false, focused: false, ttsReady: true, speaking: false, revealed: new Set(['1:me:0']), showRomanization: false, alwaysRomanize: false, alwaysPronunciation: false, autoTranslate: true, rtl: false, onReveal: vi.fn(), onBubbleTap: vi.fn(), onSpeak: vi.fn(), onPopup: vi.fn(), onInspect: vi.fn(), onHold: vi.fn(), onToggleReveal: vi.fn(), onAskCoach: vi.fn() }
}
it('places the partner reaction on the reply and routes editing to its own turn', () => {
  const input = props()
  input.turn.reaction = { kind: 'confused', interpretation: 'Uncertain meaning', explanation: 'Please clarify the reference.' }
  input.onEditUser = vi.fn()
  const view = render(<TurnView {...input} />)
  expect(view.container.querySelector('.msg.bot .partner-reaction')).not.toBeNull()
  expect(view.container.querySelector('.msg.me .partner-reaction')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Partner is unsure' }))
  fireEvent.click(screen.getByRole('button', { name: 'Edit & try again' }))
  expect(input.onEditUser).toHaveBeenCalledWith(input.turn)
  expect(input.onBubbleTap).not.toHaveBeenCalled()
})
it('keeps sentence translation buttons independent of token preferences', () => {
  const input = props()
  const view = render(<TurnView {...input} />)
  expect(screen.queryByText('Learner translation')).toBeNull()
  expect(screen.queryByText('Partner translation')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Translate partner message' }))
  expect(screen.getByText('Partner translation')).toBeVisible()
  view.rerender(<TurnView {...input} autoTranslate={false} />)
  expect(screen.getByText('Partner translation')).toBeVisible()
  expect(screen.queryByText('Learner translation')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Translate partner message' }))
  expect(screen.queryByText('Partner translation')).toBeNull()
})

it('honors pronunciation even when token information is revealed', () => {
  const input = props()
  input.turn.assistant!.reply = 'Soy Elia.'
  input.turn.assistant!.tokens = [
    { text: 'Soy', gloss: 'I am', pronunciation: 'soy', romanization: null, pos: null, notable: false },
    { text: 'Elia.', gloss: 'Elia', pronunciation: 'Eh-lee-ah', romanization: null, pos: null, notable: false },
  ]
  const view = render(<TurnView {...input} />)
  const soy = screen.getByRole('button', { name: 'Soy' })
  fireEvent.click(soy)
  expect(input.onToggleReveal).toHaveBeenCalledWith(['1:bot:0'])
  view.rerender(<TurnView {...input} revealed={new Set(['1:bot:0'])} />)
  expect(soy.closest('.wu')).toHaveTextContent('I am')
  expect(view.container.querySelector('.wpronunciation')).toBeNull()
  expect(screen.queryByText('Eh-lee-ah')).toBeNull()
  expect(view.container.querySelector('.phrase-pronunciation')).toBeNull()
  view.rerender(<TurnView {...input} alwaysPronunciation={true} />)
  expect(screen.getByText('Eh-lee-ah').closest('.wu')).toHaveTextContent('Elia.')
  expect(screen.getByText('Eh-lee-ah').closest('.wu')).not.toHaveTextContent('I am')
})

it('renders source punctuation once and anchors feedback inside the learner bubble', () => {
  const input = props()
  input.turn.assistant!.reply = '¡Hola! ¿Te gusta el sol?'
  input.turn.assistant!.tokens = ['¡', '¡Hola!', '!', '¿', '¿Te', 'gusta', 'el', 'sol?', '?'].map(text => ({text,gloss:null,pronunciation:null,romanization:null,pos:null,notable:false}))
  const view = render(<TurnView {...input} revealed={new Set()} autoTranslate={false} />)
  expect(view.container.querySelector('.msg.bot .line')!.textContent).toBe('¡Hola! ¿Te gusta el sol?')
  expect(screen.getByRole('button', { name: 'Coach feedback for message 1' }).closest('.msg.me')).not.toBeNull()
})

it('does not expose playback without a connected action', () => {
  const input = props()
  const view = render(<TurnView {...input} onSpeak={undefined} />)
  expect(screen.queryByRole('button', { name: 'Speak reply' })).not.toBeInTheDocument()
  view.rerender(<TurnView {...input} />)
  fireEvent.click(screen.getByRole('button', { name: 'Speak reply' }))
  expect(input.onSpeak).toHaveBeenCalledWith('Hola', 1)
})

it('retries partial saved gloss only on explicit request and keeps reading during retry', async () => {
  const input = props()
  input.turn.assistant!.tokens = []
  input.turn.assistant!.savedGloss = { sourceMessageId: 'message', targetLanguageId: 'spanish', explanationLanguageId: 'english', formatVersion: 'format', templateVersion: 'template', boundaryPolicy: 'policy', operationId: 'operation', attemptId: 'attempt', coverage: 'partial', segments: [{start:0,end:4,kind:'gloss',gloss:'Hello'}] }
  input.turn.assistant!.glossState = 'succeeded'
  input.turn.assistant!.glossOperationId = 'operation'
  let finish!: () => void
  input.onRetryGloss = vi.fn(() => new Promise<void>(resolve => { finish = resolve }))
  const view = render(<TurnView {...input} />)
  expect(input.onRetryGloss).not.toHaveBeenCalled()
  fireEvent.click(view.container.querySelector('.msg.bot [data-source-start] [role="button"]')!)
  expect(view.container.querySelector('.msg.bot .wg')).toHaveTextContent('Hello')
  expect(input.onRetryGloss).not.toHaveBeenCalled()
  expect(screen.getByRole('button', {name:'Retry word meanings'}).closest('.message-actions')).toBeNull()
  expect(screen.getByRole('button', {name:'Retry word meanings'}).closest('.trans')).not.toBeNull()
  fireEvent.click(screen.getByRole('button', {name:'Retry word meanings'}))
  fireEvent.click(screen.getByRole('button', {name:'Retry word meanings'}))
  expect(input.onRetryGloss).toHaveBeenCalledExactlyOnceWith('operation')
  expect(screen.getByRole('button', {name:'Retry word meanings'})).toBeDisabled()
  expect(view.container.querySelector('.msg.bot .wg')).toHaveTextContent('Hello')
  await act(async () => finish())
})

it.each([null, 'running', 'failed', 'unknown'])('keeps reply words passive without saved gloss (%s)', state => {
  const input = props()
  input.turn.assistant!.tokens = []
  input.turn.assistant!.glossState = state
  const view = render(<TurnView {...input} />)
  const text = view.container.querySelector('.msg.bot .target-text')!
  expect(text).toHaveTextContent('Hola')
  expect(text.querySelector('[role="button"]')).toBeNull()
  fireEvent.click(text)
  fireEvent.contextMenu(text)
  fireEvent.keyDown(text, {key:'Enter'})
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(input.onHold).not.toHaveBeenCalled()
  expect(input.onPopup).not.toHaveBeenCalled()
  expect(input.onInspect).not.toHaveBeenCalled()
  expect(input.onBubbleTap).not.toHaveBeenCalled()
})

it.each([
  ['ready', 'Translating…'], ['running', 'Translating…'], ['waiting_dependencies', 'Translating…'],
  ['failed', 'Translation failed'], ['unknown', 'Translation outcome unknown'],
  ['cancelled', 'Translation cancelled'], ['invalidated', 'Translation unavailable'],
])('shows authoritative translation state %s without hiding saved text or invoking work', (state, label) => {
  const input = props()
  input.turn.assistant!.translationState = state
  input.onRetryGloss = vi.fn()
  const view = render(<TurnView {...input} />)
  expect(screen.getByRole('status')).toHaveTextContent(label)
  fireEvent.click(screen.getByRole('button', { name: 'Translate partner message' }))
  expect(screen.getByText('Partner translation')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Speak reply' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: 'Translate partner message' }))
  expect(screen.queryByText('Partner translation')).toBeNull()
  expect(screen.getByRole('status')).toHaveTextContent(label)
  view.rerender(<TurnView {...input} autoTranslate={false} />)
  expect(input.onRetryGloss).not.toHaveBeenCalled()
  expect(input.onSpeak).not.toHaveBeenCalled()
  expect(input.onReveal).not.toHaveBeenCalled()
})
it('distinguishes no requested translation from failure and clears progress when translation arrives', () => {
  const input = props()
  input.turn.assistant!.translation = null
  const view = render(<TurnView {...input} />)
  expect(screen.queryByRole('status')).toBeNull()
  const update = (translationState: string, translation: string | null = null) => view.rerender(<TurnView {...input} turn={{ ...input.turn, assistant: { ...input.turn.assistant!, translationState, translation } }} />)
  update('running')
  expect(screen.getByRole('status')).toHaveTextContent('Translating…')
  update('failed')
  expect(screen.getByRole('status')).toHaveTextContent('Translation failed')
  expect(screen.queryByText('Translating…')).toBeNull()
  update('succeeded', 'Saved translation')
  expect(screen.queryByRole('status')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Translate partner message' }))
  expect(screen.getByText('Saved translation')).toBeVisible()
  expect(screen.queryByRole('button', { name: /Retry translation/ })).toBeNull()
})

it('uses saved human glosses before a reply and separates scores from bottom actions', () => {
  const input = props()
  input.turn.assistant = null
  input.turn.userTranslation = 'Hello there'
  input.turn.userSavedGloss = {
    sourceMessageId: 'human', targetLanguageId: 'es', explanationLanguageId: 'en',
    formatVersion: 'v1', templateVersion: 'v1', boundaryPolicy: 'v1',
    operationId: 'human-gloss', attemptId: 'attempt', coverage: 'complete',
    segments: [{ start: 0, end: 4, kind: 'gloss', gloss: 'Hello', pronunciation: 'OH-lah' }],
  }
  const view = render(<TurnView {...input} />)
  const word = screen.getByRole('button', { name: 'Hola', expanded: false })
  fireEvent.click(word)
  expect(word).toHaveAttribute('aria-expanded', 'true')
  expect(view.container.querySelector('.msg.me .wg')).toHaveTextContent('Hello')
  expect(view.container.querySelector('.msg.me .wpronunciation')).toHaveTextContent('OH-lah')
  expect(view.container.querySelector('.saved-word-help')).toBeNull()
  const grade = screen.getByRole('button', { name: 'Coach feedback for message 1' })
  expect(grade.parentElement).toHaveClass('msg', 'me')
  expect(screen.getByRole('button', { name: 'Analyze your message' }).closest('.message-actions')).not.toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Translate your message' }))
  expect(view.container.querySelector('.msg.me .trans')).toHaveTextContent('Hello there')
  fireEvent.click(word)
  expect(word).toHaveAttribute('aria-expanded', 'false')
})
