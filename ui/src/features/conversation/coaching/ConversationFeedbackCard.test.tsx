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
  expect(screen.getByRole('meter', { name: 'Grammar' })).toHaveAttribute('aria-valuetext', 'Grammar: 3/5')
  expect(screen.getByRole('meter', { name: 'Conversation fit' })).toHaveAttribute('aria-valuetext', 'Conversation fit: 5/5')
  expect(screen.getByText('Ayer').closest('.coach-wording')).toHaveAttribute('data-kind', 'target')
  expect(screen.queryByText(/not proficiency measurements/)).not.toBeInTheDocument()
  expect(screen.getByRole('region', {name:'Message assessment'})).toBeVisible()
  expect(document.querySelector('details')).toBeNull()
})
it('opens saved feedback without disclosure controls or another inference call', () => {
  const control = vi.fn()
  render(<MessageFeedback id={1} text="Ayer go." conversationFeedback={feedback} feedback={undefined} error={undefined} reviewing={false} onEdit={undefined} onAsk={vi.fn()} onControl={control} />)
  const badge=screen.getByRole('button', {name:'Coach feedback for message 1'})
  expect(badge).toHaveAttribute('data-feedback-state','complete')
  expect(screen.getByText('✍️ 3/5')).toBeVisible()
  expect(screen.getByText('🗣️ 5/5')).toBeVisible()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(control).not.toHaveBeenCalled()
  fireEvent.click(badge)
  expect(screen.getByText('fui')).toBeVisible()
  expect(control).not.toHaveBeenCalled()
})

it('shows saved scores instead of a decision teaser and opens them without disclosure or coach navigation', () => {
  const control = vi.fn()
  const openCoach = vi.fn()
  const props = { id: 1, text: 'Ayer go.', feedback: undefined, error: undefined, reviewing: false, onEdit: undefined, onAsk: vi.fn(), onControl: control, onOpenCoach: openCoach }
  const view = render(<MessageFeedback {...props} conversationFeedback={feedback} decision={{ exposedMove: null, repairStatus: null, shown: { construct: 'past', quote: 'go', move: 'hint', text: 'Unexposed hint' }, retryInvited: true, fixed: null, alsoNoticed: [], keptGoing: false }} />)
  const badge = screen.getByRole('button', { name: 'Coach feedback for message 1' })
  expect(screen.getByText('✍️ 3/5')).toBeVisible()
  expect(screen.getByText('🗣️ 5/5')).toBeVisible()
  expect(badge).not.toHaveTextContent('hint')
  expect(badge).not.toHaveTextContent('Ask the coach')
  expect(badge).toHaveAttribute('aria-haspopup', 'dialog')
  expect(badge).toHaveAccessibleDescription('Grammar: 3/5 Conversation fit: 5/5')
  expect(screen.getByText('Grammar: 3/5')).not.toBeVisible()
  expect(screen.getByText('Conversation fit: 5/5')).not.toBeVisible()
  fireEvent.click(badge)
  expect(screen.getByRole('dialog')).toHaveTextContent('Your meaning is clear.')
  expect(control).not.toHaveBeenCalled()
  expect(openCoach).not.toHaveBeenCalled()
  view.rerender(<MessageFeedback {...props} conversationFeedback={{ ...feedback, grammar: 4, conversation: 2 }} />)
  expect(screen.getByText('✍️ 4/5')).toBeVisible()
  expect(screen.getByText('🗣️ 2/5')).toBeVisible()
})
