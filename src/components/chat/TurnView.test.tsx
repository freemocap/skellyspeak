// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { TurnView, type TurnViewProps } from './TurnView'

function props(): TurnViewProps {
  const token = { text: 'Hola', gloss: 'Hello', pos: null, notable: false, romanization: null }
  return { turn: { id: 1, user: 'Hola', pendingText: '', assistant: { reply: 'Hola', tokens: [token], user_tokens: [token], translation: 'Partner translation', user_translation: 'Learner translation', mechanics: [], scaffolds: { replies: [], frames: [], starters: [] }, errors: [] } }, reviewing: false, targetLangCode: 'es', nativeLangCode: 'en', focused: false, ttsReady: true, speaking: false, revealed: new Set(['1:me:0']), showRomanization: false, alwaysRomanize: false, autoTranslate: true, rtl: false, onReveal: vi.fn(), onBubbleTap: vi.fn(), onSpeak: vi.fn(), onPopup: vi.fn(), onInspect: vi.fn(), onHold: vi.fn(), onToggleReveal: vi.fn(), onAskCoach: vi.fn() }
}
it('keeps each message side independent and translation toggles effective with auto-translation', () => {
  const input = props()
  const view = render(<TurnView {...input} />)
  expect(view.container.querySelector('.msg.me .wg')).toHaveTextContent('Hello')
  expect(view.container.querySelector('.msg.bot .wg')).toBeNull()
  expect(screen.queryByText('Learner translation')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Translate your message' }))
  expect(screen.getByText('Learner translation')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Translate partner message' }))
  expect(screen.queryByText('Partner translation')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Speak reply' }))
  expect(input.onSpeak).toHaveBeenCalledOnce()
  expect(input.onBubbleTap).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Analysis' }))
  expect(input.onBubbleTap).toHaveBeenCalledOnce()
})
