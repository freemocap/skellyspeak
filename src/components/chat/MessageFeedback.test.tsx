// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MessageFeedback } from './MessageFeedback'
import type { Feedback } from '../../contracts'
vi.mock('../../lib/back', () => ({ openOverlay: () => () => {} }))
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function (): void { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function (): void { this.removeAttribute('open') }
})
const feedback = (over: Partial<Feedback> = {}): Feedback => ({ correctness: 5, understandability: 5, explanation: 'A clear, appropriate refusal.', correction: '', evidence: [], ...over })

it('shows both model scores on the badge', () => {
  render(<MessageFeedback id={1} text="No, gracias." feedback={feedback()} error={undefined} reviewing={false} onEdit={undefined} onAsk={vi.fn()} />)
  expect(screen.getByRole('button', { name: /Coach feedback for message/ })).toHaveTextContent('Correctness 5/5 · Understanding 5/5')
})

it('opens everything the coach saved once, with no placeholder, and routes a question', () => {
  const ask = vi.fn()
  const saved = feedback({ correctness: 2, understandability: 4, explanation: 'Use fui for yo.', correction: 'Yo fui ayer.',
    evidence: [{ skill_id: 'social_checkin', quote: 'Yo fue ayer', outcome: 'partial', rationale: 'Past reference with the wrong verb form.' }] })
  render(<MessageFeedback id={3} text="Yo fue ayer" feedback={saved} error={undefined} reviewing={false} onEdit={undefined} onAsk={ask} />)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Coach feedback for message 3' }))
  const dialog = screen.getByRole('dialog')
  expect(screen.getAllByText('Use fui for yo.')).toHaveLength(1)
  expect(dialog).toHaveTextContent('Suggested version')
  expect(dialog).toHaveTextContent('Yo fui ayer.')
  expect(dialog).toHaveTextContent('Exchange social pleasantries')
  expect(dialog).toHaveTextContent('Partly shown')
  expect(dialog).toHaveTextContent('Past reference with the wrong verb form.')
  expect(screen.queryByLabelText('Detailed analysis')).toBeNull()
  expect(screen.queryByRole('button', { name: /Edit/ })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Ask the coach' }))
  expect(ask).toHaveBeenCalledWith('Help me understand the feedback on my message: “Yo fue ayer”')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('distinguishes pending, failed, and missing feedback instead of inventing scores', () => {
  const props = { id: 1, text: 'Hola', feedback: undefined, reviewing: true, error: undefined, onEdit: undefined, onAsk: vi.fn() }
  const view = render(<MessageFeedback {...props} />)
  expect(screen.getByRole('button', { name: /Coach feedback for message/ })).toHaveTextContent('Analyzing')
  view.rerender(<MessageFeedback {...props} reviewing={false} error="Provider unavailable" />)
  expect(screen.getByRole('button', { name: /Coach feedback for message/ })).toHaveTextContent('Feedback failed')
  view.rerender(<MessageFeedback {...props} reviewing={false} />)
  expect(screen.getByRole('button', { name: /Coach feedback for message/ })).toHaveTextContent('Feedback unavailable')
})
