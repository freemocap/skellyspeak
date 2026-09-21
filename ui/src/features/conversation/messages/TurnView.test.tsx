// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { TurnView as SharedTurnView, type TurnViewProps } from './TurnView'

import { ReadingPreferencesContext } from '../../../components/reading/ReadingPreferences'

function TurnView(input: TurnViewProps) {
  return <ReadingPreferencesContext value={{autoTranslate:input.autoTranslate, alwaysRomanize:input.alwaysRomanize, alwaysPronunciation:input.alwaysPronunciation, supportsRomanization:input.showRomanization}}><SharedTurnView {...input} /></ReadingPreferencesContext>
}

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
})

function props(): TurnViewProps {
  const token = { text: 'Hola', gloss: 'Hello', pos: null, notable: false, romanization: null, pronunciation: null }
  return { turn: { id: 1, user: 'Hola', pendingText: '', assistant: { reply: 'Hola', tokens: [token], user_tokens: [token], translation: 'Persona translation', user_translation: 'Learner translation', mechanics: [], scaffolds: { replies: [], frames: [], starters: [] }, errors: [] } }, reviewing: false, focused: false, ttsReady: true, speaking: false, revealed: new Set(['1:me:0']), showRomanization: false, alwaysRomanize: false, alwaysPronunciation: false, autoTranslate: false, rtl: false, onReveal: vi.fn(), onBubbleTap: vi.fn(), onSpeak: vi.fn(), onPopup: vi.fn(), onInspect: vi.fn(), onHold: vi.fn(), onToggleReveal: vi.fn(), onAskCoach: vi.fn() }
}
it('places the persona reaction on the reply', () => {
  const input = props()
  input.turn.reaction = { kind: 'confused', interpretation: 'Uncertain meaning', explanation: 'Please clarify the reference.' }
  const view = render(<TurnView {...input} />)
  expect(view.container.querySelector('.msg.bot .persona-reaction')).not.toBeNull()
  expect(view.container.querySelector('.msg.me .persona-reaction')).toBeNull()
})
it('keeps an explicit message translation override when the default changes', () => {
  const input = props()
  const view = render(<TurnView {...input} />)
  expect(screen.queryByText('Learner translation')).toBeNull()
  expect(screen.queryByText('Persona translation')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Translate persona message' }))
  expect(screen.getByText('Persona translation')).toBeVisible()
  view.rerender(<TurnView {...input} autoTranslate={true} />)
  expect(screen.getByText('Persona translation')).toBeVisible()
  expect(screen.getByText('Learner translation')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Translate persona message' }))
  expect(screen.queryByText('Persona translation')).toBeNull()
})

it('honors pronunciation even when token information is revealed', () => {
  const input = props()
  input.autoTranslate = true
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

it('renders source punctuation once and anchors feedback below the learner bubble', () => {
  const input = props()
  input.turn.assistant!.reply = '¡Hola! ¿Te gusta el sol?'
  input.turn.assistant!.tokens = ['¡', '¡Hola!', '!', '¿', '¿Te', 'gusta', 'el', 'sol?', '?'].map(text => ({text,gloss:null,pronunciation:null,romanization:null,pos:null,notable:false}))
  const view = render(<TurnView {...input} revealed={new Set()} autoTranslate={false} />)
  expect(view.container.querySelector('.msg.bot .line')!.textContent).toBe('¡Hola! ¿Te gusta el sol?')
  expect(screen.getByRole('button', { name: 'Coach feedback for message 1' }).closest('.message-feedback')).not.toBeNull()
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
  input.autoTranslate = true
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

it('keeps accepted meanings visible while background repair is pending', () => {
  const input = props()
  input.autoTranslate = true
  input.onRetryGloss = vi.fn()
  input.turn.assistant!.tokens = []
  input.turn.assistant!.savedGloss = { sourceMessageId: 'message', targetLanguageId: 'spanish', explanationLanguageId: 'english', formatVersion: 'format', templateVersion: 'policy', boundaryPolicy: 'policy', operationId: 'operation', attemptId: 'attempt', coverage: 'partial', segments: [{start:0,end:4,kind:'gloss',gloss:'Hello'}] }
  input.turn.assistant!.glossState = 'running'
  input.turn.assistant!.glossOperationId = 'operation'
  const view = render(<TurnView {...input} />)
  expect(screen.getByText('Finishing word meanings…')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Retry word meanings' })).toBeNull()
  fireEvent.click(view.container.querySelector('.msg.bot [data-source-start] [role="button"]')!)
  expect(view.container.querySelector('.msg.bot .wg')).toHaveTextContent('Hello')
  expect(input.onRetryGloss).not.toHaveBeenCalled()
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
  fireEvent.click(screen.getByRole('button', { name: 'Translate persona message' }))
  expect(screen.getByText('Persona translation')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Speak reply' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: 'Translate persona message' }))
  expect(screen.queryByText('Persona translation')).toBeNull()
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
  fireEvent.click(screen.getByRole('button', { name: 'Translate persona message' }))
  expect(screen.getByText('Saved translation')).toBeVisible()
  expect(screen.queryByRole('button', { name: /Retry translation/ })).toBeNull()
})

it('uses saved human glosses before a reply and separates scores from bottom actions', () => {
  const input = props()
  input.autoTranslate = true
  input.alwaysPronunciation = true
  input.turn.assistant = null
  input.turn.userTranslation = 'Hello there'
  input.turn.userSavedGloss = {
    sourceMessageId: 'human', targetLanguageId: 'spanish', explanationLanguageId: 'english',
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
  expect(view.container.querySelector('.saved-word-help')).toHaveAttribute('popover', 'manual')
  const grade = screen.getByRole('button', { name: 'Coach feedback for message 1' })
  expect(grade.parentElement).toHaveClass('message-feedback')
  expect(grade.closest('.msg.me')).not.toBeNull()
  expect(screen.getByRole('button', { name: 'Analyze your message' }).closest('.message-actions')).not.toBeNull()
  expect(view.container.querySelector('.msg.me .trans')).toHaveTextContent('Hello there')
  fireEvent.click(word)
  expect(word).toHaveAttribute('aria-expanded', 'false')
})

it('lets a message hide translation while the conversation default stays on', () => {
  const input = props()
  const view = render(<TurnView {...input} autoTranslate />)
  expect(screen.getByText('Persona translation')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Translate persona message' }))
  expect(screen.queryByText('Persona translation')).toBeNull()
  expect(screen.getByText('Learner translation')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Translate persona message' })).toHaveAttribute('aria-pressed', 'false')
  view.rerender(<TurnView {...input} autoTranslate={false} />)
  view.rerender(<TurnView {...input} autoTranslate />)
  expect(screen.queryByText('Persona translation')).toBeNull()
})

it('reveals saved word meanings without starting inference or changing whole-message translation', () => {
  const input = props()
  input.autoTranslate = true
  input.turn.assistant!.tokens = []
  input.turn.assistant!.savedGloss = { sourceMessageId: 'message', targetLanguageId: 'spanish', explanationLanguageId: 'english', formatVersion: 'format', templateVersion: 'template', boundaryPolicy: 'policy', operationId: 'operation', attemptId: 'attempt', coverage: 'complete', segments: [{start:0,end:4,kind:'gloss',gloss:'Hello'}] }
  const view = render(<TurnView {...input} />)
  fireEvent.click(screen.getByRole('button', { name: 'Translate persona message' }))
  const words = within(view.container.querySelector('.msg.bot') as HTMLElement).getByRole('button', {name:'Word by word'})
  expect(words).toBeEnabled()
  fireEvent.click(words)
  expect(view.container.querySelector('.msg.bot .wg')).toBeNull()
  fireEvent.click(words)
  expect(view.container.querySelector('.msg.bot .wg')).toHaveTextContent('Hello')
  expect(screen.queryByText('Persona translation')).toBeNull()
  expect(input.onToggleReveal).not.toHaveBeenCalled()
  fireEvent.click(words)
  expect(view.container.querySelector('.msg.bot .wg')).toBeNull()
})

it('shows a failed learner translation on the learner message without invented text', () => {
  const input = props()
  input.turn.userTranslationState = 'failed'
  input.turn.userTranslation = null
  input.turn.assistant!.user_translation = null
  const view = render(<TurnView {...input} />)
  expect(view.container.querySelector('.msg.me [role="status"]')?.textContent).toBe('Translation failed')
  expect(view.container.querySelector('.msg.bot [role="status"]')).toBeNull()
})


it('keeps corner edit and playback actions isolated from token reveal and honors their availability', () => {
  const input = props()
  const edit = vi.fn()
  const view = render(<TurnView {...input} onEditUser={edit} rtl />)
  const pencil = screen.getByRole('button', { name: 'Edit message' })
  const speaker = screen.getByRole('button', { name: 'Speak reply' })
  expect(pencil).toHaveTextContent('✏️')
  expect(pencil.closest('.msg.me')).toHaveClass('with-corner-control', 'rtl')
  expect(speaker.closest('.msg.bot')).toHaveClass('with-corner-control', 'rtl')
  fireEvent.click(pencil)
  fireEvent.doubleClick(pencil)
  fireEvent.click(speaker)
  fireEvent.doubleClick(speaker)
  expect(edit).toHaveBeenCalledExactlyOnceWith(input.turn)
  expect(input.onSpeak).toHaveBeenCalledExactlyOnceWith('Hola', 1)
  expect(input.onToggleReveal).not.toHaveBeenCalled()
  view.rerender(<TurnView {...input} onEditUser={edit} editDisabled speaking />)
  expect(screen.getByRole('button', { name: 'Edit message' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Stop playback' }))
  expect(input.onSpeak).toHaveBeenCalledTimes(2)
  view.rerender(<TurnView {...input} onEditUser={undefined} ttsReady={false} />)
  expect(screen.queryByRole('button', { name: 'Edit message' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Speak reply' })).toBeNull()
})


it('attaches both assistance rows to their source bubble and toggles only learner token keys', () => {
  const input = props()
  input.autoTranslate = true
  const view = render(<TurnView {...input} />)
  const learner = view.container.querySelector('.msg.me') as HTMLElement
  const partner = view.container.querySelector('.msg.bot') as HTMLElement
  for (const bubble of [learner, partner]) {
    expect(within(bubble).getByRole('button', { name: /Translate/ }).closest('.message-actions')).not.toBeNull()
    expect(within(bubble).getByRole('button', { name: /Analy/ }).closest('.message-actions')).not.toBeNull()
  }
  const words = within(learner).getByRole('button', { name: 'Word by word' })
  expect(words).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(words)
  expect(input.onToggleReveal).not.toHaveBeenCalled()
  expect(within(partner).getByRole('button', { name: 'Word by word' })).toHaveAttribute('aria-pressed', 'true')
  input.onToggleReveal = vi.fn()
  view.rerender(<TurnView {...input} revealed={new Set()} />)
  expect(words).toHaveAttribute('aria-pressed', 'false')
  for (const action of learner.querySelectorAll('.message-feedback button')) fireEvent.doubleClick(action)
  for (const action of partner.querySelectorAll('.message-actions button')) fireEvent.doubleClick(action)
  expect(input.onToggleReveal).not.toHaveBeenCalled()
  fireEvent.click(within(learner).getByRole('button', { name: 'Analyze your message' }))
  const dialog = screen.getByRole('dialog', { name: 'Feedback on your message' })
  expect(dialog.parentElement).toBe(document.body)
})

it('toggles saved learner meanings independently before a reply without requesting work', () => {
  const input = props()
  input.autoTranslate = true
  input.turn.assistant = null
  input.turn.userTranslation = 'Hello there'
  input.turn.userGlossState = 'running'
  input.turn.userSavedGloss = {
    sourceMessageId: 'human', targetLanguageId: 'spanish', explanationLanguageId: 'english',
    formatVersion: 'v1', templateVersion: 'v1', boundaryPolicy: 'v1',
    operationId: 'human-gloss', attemptId: 'attempt', coverage: 'partial',
    segments: [{ start: 0, end: 4, kind: 'gloss', gloss: 'Hello' }],
  }
  input.onRetryGloss = vi.fn()
  const view = render(<TurnView {...input} />)
  fireEvent.click(screen.getByRole('button', { name: 'Translate your message' }))
  const words = screen.getByRole('button', { name: 'Word by word' })
  expect(words).toBeEnabled()
  expect(words).toHaveClass('is-hydrating')
  fireEvent.click(words)
  expect(view.container.querySelector('.msg.me .wg')).toBeNull()
  fireEvent.click(words)
  expect(words).toHaveAttribute('aria-pressed', 'true')
  expect(view.container.querySelector('.msg.me .wg')).toHaveTextContent('Hello')
  expect(screen.queryByText('Hello there')).toBeNull()
  fireEvent.click(words)
  expect(view.container.querySelector('.msg.me .wg')).toBeNull()
  expect(input.onToggleReveal).not.toHaveBeenCalled()
  expect(input.onRetryGloss).not.toHaveBeenCalled()
  expect(input.onAskCoach).not.toHaveBeenCalled()
})

it('keeps word actions disabled without annotations and allows them when saved meanings arrive', () => {
  const input = props()
  input.turn.assistant!.user_tokens = []
  input.turn.assistant!.tokens = []
  input.turn.userGlossState = 'running'
  input.turn.assistant!.glossState = 'failed'
  const view = render(<TurnView {...input} />)
  for (const words of screen.getAllByRole('button', { name: 'Word by word' })) {
    expect(words).toBeDisabled()
    expect(words).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(words)
  }
  expect(input.onToggleReveal).not.toHaveBeenCalled()
  const token = { text: 'Hola', gloss: 'Hello', pos: null, notable: false, romanization: null, pronunciation: null }
  view.rerender(<TurnView {...input} turn={{ ...input.turn, assistant: { ...input.turn.assistant!, user_tokens: [token] } }} />)
  expect(within(view.container.querySelector('.msg.me') as HTMLElement).getByRole('button', { name: 'Word by word' })).toBeEnabled()
})

it('reveals Arabic token meanings through the shaping-safe renderer on either side', () => {
  const input = props()
  input.autoTranslate = true
  const token = { text: 'بيوت', gloss: 'houses', romanization: 'buyūt', pronunciation: null, pos: null, notable: false }
  input.turn.user = 'بيوت'
  input.turn.assistant!.reply = 'بيوت'
  input.turn.assistant!.tokens = [token]
  input.turn.assistant!.user_tokens = [token]
  const view = render(<TurnView {...input} rtl />)
  const learner = view.container.querySelector('.msg.me') as HTMLElement
  const partner = view.container.querySelector('.msg.bot') as HTMLElement
  fireEvent.click(within(partner).getByRole('button', { name: 'Word by word' }))
  fireEvent.click(within(learner).getByRole('button', { name: 'Word by word' }))
  fireEvent.click(within(learner).getByRole('button', { name: 'Word by word' }))
  expect(learner.querySelector('.wg')).toHaveTextContent('houses')
  expect(partner.querySelector('.wg')).toBeNull()
  fireEvent.click(within(partner).getByRole('button', { name: 'Word by word' }))
  expect(partner.querySelector('.wg')).toHaveTextContent('houses')
  expect(input.onToggleReveal).not.toHaveBeenCalled()
})


it('keeps assistance in interface direction independently of the source script', async () => {
  const input = props()
  document.documentElement.dir = 'rtl'
  const view = render(<TurnView {...input} rtl={false} />)
  expect(view.container.querySelector('.msg.me .message-feedback')).toHaveAttribute('dir', 'rtl')
  expect(view.container.querySelector('.msg.bot .message-actions')).toHaveAttribute('dir', 'rtl')
  await act(async () => { document.documentElement.dir = 'ltr' })
  view.rerender(<TurnView {...input} rtl />)
  expect(view.container.querySelector('.msg.me .message-feedback')).toHaveAttribute('dir', 'ltr')
  expect(view.container.querySelector('.msg.bot .message-actions')).toHaveAttribute('dir', 'ltr')
})

it.each(['tokens', 'saved', 'joining'] as const)('updates enabled aids on both message sides through the %s path', path => {
  const input = props()
  const text = path === 'joining' ? 'بيوت' : 'Hola'
  const token = {text, gloss:'meaning', romanization:'roman', pronunciation:'redundant', pos:null, notable:false}
  input.turn.user = text
  input.turn.assistant!.reply = text
  input.turn.assistant!.tokens = [token]
  input.turn.assistant!.user_tokens = [token]
  input.revealed = new Set()
  if (path === 'saved') {
    input.turn.userSavedGloss = input.turn.assistant!.savedGloss = {
      sourceMessageId:'message', targetLanguageId:'language', explanationLanguageId:'english',
      formatVersion:'format', templateVersion:'template', boundaryPolicy:'policy',
      operationId:'operation', attemptId:'attempt', coverage:'complete',
      segments:[{start:0,end:text.length,kind:'gloss',gloss:'meaning',romanization:'roman',pronunciation:'redundant'}],
    }
  }
  const view = render(<TurnView {...input} autoTranslate alwaysRomanize alwaysPronunciation showRomanization />)
  for (const side of ['me','bot']) {
    const bubble = view.container.querySelector(`.msg.${side}`) as HTMLElement
    expect(bubble.querySelector('.wg')).toHaveTextContent('meaning')
    expect(bubble.querySelector('.wroman')).toHaveTextContent('roman')
    expect(bubble.querySelector('.wpronunciation')).toBeNull()
    fireEvent.click(within(bubble).getByRole('button', {name:'Word by word'}))
    expect(bubble.querySelector('.wg')).toBeNull()
  }
  view.rerender(<TurnView {...input} autoTranslate={false} alwaysRomanize={false} alwaysPronunciation showRomanization />)
  expect(view.container.querySelector('.wg,.wroman,.wpronunciation')).toBeNull()
  view.rerender(<TurnView {...input} autoTranslate alwaysRomanize alwaysPronunciation showRomanization />)
  expect(view.container.querySelectorAll('.wg')).toHaveLength(2)
  expect(view.container.querySelectorAll('.wroman')).toHaveLength(2)
  expect(input.onAskCoach).not.toHaveBeenCalled()
})

it.each(['tokens', 'saved', 'joining'] as const)('Word by word explicitly reveals and hides each side with all defaults off (%s)', path => {
  const input = props()
  input.revealed = new Set()
  input.showRomanization = true
  const text = path === 'joining' ? 'بيوت باب' : 'Hola casa'
  const words = text.split(' ')
  const tokens = words.map((text, index) => ({text, gloss:index ? 'second meaning' : 'meaning', romanization:index ? null : 'roman', pronunciation:index ? 'fallback' : 'redundant', pos:null, notable:false}))
  input.turn.user = text
  input.turn.assistant!.reply = text
  input.turn.assistant!.tokens = tokens
  input.turn.assistant!.user_tokens = tokens
  if (path === 'saved') {
    input.turn.userSavedGloss = input.turn.assistant!.savedGloss = {
      sourceMessageId:'message', targetLanguageId:'language', explanationLanguageId:'english',
      formatVersion:'format', templateVersion:'template', boundaryPolicy:'policy',
      operationId:'operation', attemptId:'attempt', coverage:'complete',
      segments:tokens.map((token,index) => ({start:index ? words[0].length+1 : 0,end:index ? text.length : words[0].length,kind:'gloss',gloss:token.gloss,romanization:token.romanization ?? undefined,pronunciation:token.pronunciation})),
    }
  }
  const view = render(<TurnView {...input} />)
  expect(view.container.querySelector('.wg,.wroman,.wpronunciation')).toBeNull()
  for (const side of ['me','bot']) {
    const bubble = view.container.querySelector(`.msg.${side}`) as HTMLElement
    const button = within(bubble).getByRole('button',{name:'Word by word'})
    expect(button).toHaveAttribute('aria-pressed','false')
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-pressed','true')
    expect(within(bubble).getByText('meaning')).toBeVisible()
    expect(within(bubble).getByText('roman')).toBeVisible()
    expect(within(bubble).getByText('fallback')).toBeVisible()
    expect(within(bubble).queryByText('redundant')).toBeNull()
    expect(within(bubble).queryByText('Persona translation')).toBeNull()
    expect(within(bubble).queryByText('Learner translation')).toBeNull()
    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-pressed','false')
    expect(bubble.querySelector('.wg,.wroman,.wpronunciation')).toBeNull()
  }
  expect(input.onAskCoach).not.toHaveBeenCalled()
  expect(input.onToggleReveal).not.toHaveBeenCalled()
})

it('attaches localized Jev XP to the exact source span without a separate badge row', async () => {
  const { SkillEvidenceContext } = await import('../../../state/learning/useSkillEvidence')
  const { PracticeContext } = await import('../session/PracticeContext')
  const { RewardInspectionContext } = await import('../progress/RewardInspectionContext')
  const { skillDemo } = await import('../../../domain/learning/catalog/skillDemo')
  const { unreportedInput } = await import('../../../domain/learning/evidence/skills')
  const snapshot = structuredClone(skillDemo)
  snapshot.records = [{ attempt_id: 'jev', session_id: 'test', turn_id: 1, message_id: 1, replaces_message_id: null, construct_registry_hash: snapshot.construct_registry_hash, mapping_error: null, support_step: null, chat_id: 'chat', learner_id: snapshot.learner_id, target: snapshot.target, native: 'english', source: 'Hola', input: unreportedInput(), at_secs: 1, model: 'typesafe/jev-1.13', provider_mode: 'custom', catalog_version: snapshot.catalog_version, prompt_version: 'jev-choice-assessment-1', assessment_adapter: 'jev_choice', status: 'complete', error: null, assessment: { judgments: [{ skill_id: 'referent', outcome: 'demonstrated', quotes: ['Hola'], rationale: '', evidence_kind: 'quoted' }] } }]
  snapshot.profile.credits = [{ attempt_id: 'jev', skill_id: 'referent', xp: 10 }]
  const open = vi.fn()
  const view = render(<SkillEvidenceContext value={{ snapshot, error: null }}><PracticeContext value={{ chatId: 'chat', selectionVersion: 0, selected: null, select: vi.fn() }}><RewardInspectionContext value={{ open, arrive: vi.fn() }}><TurnView {...props()} /></RewardInspectionContext></PracticeContext></SkillEvidenceContext>)
  expect(view.container.querySelector('.message-evidence')).toHaveTextContent('Hola')
  expect(view.container.querySelector('.message-credit-badges')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Inspect 10 XP · Identify a referent' }))
  expect(view.container.querySelector('.message-credit-badges')).toBeNull()
  expect(view.container.querySelector('.whole-message-credit-source')).toBeNull()
  expect(open).toHaveBeenCalledWith([expect.objectContaining({ id: 'jev:referent', quote: 'Hola', xp: 10 })], 1, 'Hola')
})
