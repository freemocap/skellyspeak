// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, expect, it, vi } from 'vitest'
import { ConversationFeedbackCard } from './ConversationFeedbackCard'
import { MessageFeedback } from './MessageFeedback'
beforeAll(() => { HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }; HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') } })
const feedback = { remark: 'Your meaning is clear.', usedTarget: ['Ayer'], usedNative: ['go'], grammar: 3, conversation: 5, corrections: [{ said: 'go', corrected: 'fui', explanation: 'Use [[past tense]] for yesterday.', kind: 'missing_expression' }] }
it('shows the direct correction and opens a contextual curiosity question', () => {
  const onAsk = vi.fn()
  render(<ConversationFeedbackCard feedback={feedback} onAsk={onAsk} />)
  expect(screen.getByText('fui')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: /past tense/ }))
  expect(onAsk.mock.calls[0][0]).toContain('fui')
  expect(screen.getByText('Grammar: 3/5', { exact: false })).toHaveTextContent('Conversation fit: 5/5')
  expect(screen.getByText(/not proficiency measurements/)).toBeInTheDocument()
})
it('opens saved feedback without disclosure controls or another inference call', () => {
  const control = vi.fn()
  render(<MessageFeedback id={1} text="Ayer go." conversationFeedback={feedback} feedback={undefined} error={undefined} reviewing={false} onEdit={undefined} onAsk={vi.fn()} onControl={control} />)
  const badge=screen.getByRole('button', {name:'Coach feedback for message 1'})
  expect(badge).toHaveAttribute('data-feedback-state','complete')
  fireEvent.click(badge)
  expect(screen.getByText('fui')).toBeVisible()
  expect(control).not.toHaveBeenCalled()
})
