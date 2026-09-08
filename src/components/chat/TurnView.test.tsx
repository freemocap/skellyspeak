// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { TurnView, type TurnViewProps } from './TurnView'

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
})

function props(): TurnViewProps {
  const token = { text: 'Hola', gloss: 'Hello', pos: null, notable: false, romanization: null, pronunciation: null }
  return { turn: { id: 1, user: 'Hola', pendingText: '', assistant: { reply: 'Hola', tokens: [token], user_tokens: [token], translation: 'Partner translation', user_translation: 'Learner translation', mechanics: [], scaffolds: { replies: [], frames: [], starters: [], coach_help: null }, errors: [] } }, reviewing: false, targetLangCode: 'es', nativeLangCode: 'en', focused: false, ttsReady: true, speaking: false, revealed: new Set(['1:me:0']), showRomanization: false, alwaysRomanize: false, alwaysPronunciation: false, autoTranslate: true, rtl: false, onReveal: vi.fn(), onBubbleTap: vi.fn(), onSpeak: vi.fn(), onPopup: vi.fn(), onInspect: vi.fn(), onHold: vi.fn(), onToggleReveal: vi.fn(), onAskCoach: vi.fn() }
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
it('keeps each message side independent and translation dialogs independent of auto-translation', () => {
  const input = props()
  const view = render(<TurnView {...input} />)
  expect(view.container.querySelector('.msg.me .wg')).toHaveTextContent('Hello')
  expect(view.container.querySelector('.msg.bot .wg')).toBeNull()
  expect(screen.queryByText('Learner translation')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Translate your message' }))
  expect(screen.getByRole('dialog', { name: 'Your message translation' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Close Your message translation' }))
  fireEvent.click(screen.getByRole('button', { name: 'Translate partner message' }))
  expect(screen.getByRole('dialog', { name: 'Partner message translation' })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Close Partner message translation' }))
  expect(screen.getByText('Partner translation')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Speak reply' }))
  expect(input.onSpeak).toHaveBeenCalledOnce()
  expect(input.onBubbleTap).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Analysis' }))
  expect(input.onBubbleTap).toHaveBeenCalledOnce()
})

it('keeps pronunciation under its own word and reveals it with the token information', () => {
  const input = props()
  input.turn.assistant!.tokens = [
    { text: 'Soy', gloss: 'I am', pronunciation: 'soy', romanization: null, pos: null, notable: false },
    { text: 'Elia.', gloss: 'Elia', pronunciation: 'Eh-lee-ah', romanization: null, pos: null, notable: false },
  ]
  const view = render(<TurnView {...input} />)
  const soy = screen.getByRole('button', { name: 'Soy' })
  fireEvent.click(soy)
  expect(input.onToggleReveal).toHaveBeenCalledWith(['1:bot:0'])
  view.rerender(<TurnView {...input} revealed={new Set(['1:bot:0'])} />)
  expect(soy.closest('.wu')).toHaveTextContent('I amsoy')
  expect(screen.queryByText('Eh-lee-ah')).toBeNull()
  expect(view.container.querySelector('.phrase-pronunciation')).toBeNull()
  view.rerender(<TurnView {...input} alwaysPronunciation={true} />)
  expect(screen.getByText('Eh-lee-ah').closest('.wu')).toHaveTextContent('Elia.')
  expect(screen.getByText('Eh-lee-ah').closest('.wu')).not.toHaveTextContent('I am')
})
