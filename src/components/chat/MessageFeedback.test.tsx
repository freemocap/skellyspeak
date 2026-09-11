// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MessageFeedback } from './MessageFeedback'
vi.mock('../../lib/back', () => ({ openOverlay: () => () => {} }))
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function (): void { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function (): void { this.removeAttribute('open') }
})
it('shows grammar and conversational fit without an understanding score', () => {
  render(<MessageFeedback id={1} text="No, gracias." feedback={{ conversation: 5, grammar: 5, remark: 'A clear, appropriate refusal.', used_target: [], used_native: [], corrections: [] }} error={undefined} reviewing={false} targetLangCode="es" nativeLangCode="en" onEdit={undefined} onAsk={vi.fn()} />)
  expect(screen.getByRole('button', { name: /Coach feedback for message/ })).toHaveTextContent('Grammar 5/5 · Understanding 5/5')
  expect(screen.queryByText(/Understood/)).toBeNull()
})
it('opens the selected message feedback and routes a question with that message', () => {
  const ask = vi.fn()
  render(<MessageFeedback id={3} text="Yo fue ayer" feedback={{ comprehensibility: 4, grammar: 2, remark: 'Use fui for yo.', used_target: [], used_native: [], corrections: [{ said: 'fue', corrected: 'fui', kind: 'grammar', explanation: 'First person.' }] }} error={undefined} reviewing={false} targetLangCode="es" nativeLangCode="en" onEdit={vi.fn()} onAsk={ask} />)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Coach feedback for message 3' }))
  expect(screen.getByRole('dialog')).toHaveTextContent('First person.')
  fireEvent.click(screen.getByRole('button', { name: 'Ask the coach' }))
  expect(ask).toHaveBeenCalledWith('Help me understand the feedback on my message: “Yo fue ayer”')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
it('distinguishes pending, failed, and missing feedback instead of inventing scores', () => {
  const props = { id: 1, text: 'Hola', feedback: undefined, reviewing: true, error: undefined, targetLangCode: 'es', nativeLangCode: 'en', onEdit: undefined, onAsk: vi.fn() }
  const view = render(<MessageFeedback {...props} />)
  expect(screen.getByRole('button', { name: /Coach feedback for message/ })).toHaveTextContent('Coach analyzing')
  view.rerender(<MessageFeedback {...props} reviewing={false} error="Provider unavailable" />)
  expect(screen.getByRole('button', { name: /Coach feedback for message/ })).toHaveTextContent('Feedback failed')
  view.rerender(<MessageFeedback {...props} reviewing={false} />)
  expect(screen.getByRole('button', { name: /Coach feedback for message/ })).toHaveTextContent('Feedback unavailable')
})
