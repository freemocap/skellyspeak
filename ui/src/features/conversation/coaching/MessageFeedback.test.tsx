import { SavedGlossText } from '../../../components/reading/SavedGlossText'
// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MessageFeedback } from './MessageFeedback'
import type { CoachDecision, CoachObservationView } from '../../../generated/contracts'
import type { MessageTool } from '../../../components/reading/MessageTools'

/** The message bubble and reward the owner supplies: here, just the Analysis tool as a button. */
const frame = { reward: null, bubble: (tool: MessageTool) => <button type="button" aria-label={tool.ariaLabel} onClick={tool.onSelect}>{tool.label}</button> }
vi.mock('../../../domain/input/back', () => ({ openOverlay: () => () => {} }))
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function (): void { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function (): void { this.removeAttribute('open') }
})
const feedback: CoachObservationView = { corrections: [], notes: [], meaningRecovered: 'full', items: [], candidatesSent: 3, itemsReturned: 0 }
const decision: CoachDecision = { exposedMove: 'hint', repairStatus: null, shown: { construct: 'past', quote: 'fue', move: 'hint', text: 'Which form goes with yo?' }, retryInvited: true, fixed: null, alsoNoticed: [], keptGoing: false }
const base = { id: 3, text: 'Yo fue ayer', feedback, decision, error: undefined, reviewing: false, onEdit: vi.fn(), onAsk: vi.fn() }
it('shows a neutral feedback chip and the policy hint without grades or an invented answer', () => {
  render(<MessageFeedback {...frame} {...base} />)
  expect(screen.getByRole('button', { name: /Coach feedback for message/ })).toHaveTextContent('1 error')
  expect(screen.getByRole('button', { name: /Coach feedback for message/ })).not.toHaveTextContent('Which form goes with yo?')
  fireEvent.click(screen.getByRole('button', { name: /Coach feedback for message/ }))
  expect(screen.getByRole('dialog')).toHaveTextContent('Which form goes with yo?')
  expect(screen.queryByText(/Correctness|Understanding|\/5/)).toBeNull()
  expect(screen.queryByText('fui')).toBeNull()
})
it('persists Show answer before rendering the resulting native explicit correction', async () => {
  const control = vi.fn().mockResolvedValue(undefined)
  const view = render(<MessageFeedback {...frame} {...base} onControl={control} />)
  fireEvent.click(screen.getByRole('button', { name: /Coach feedback for message/ }))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Show answer' })))
  expect(control).toHaveBeenCalledWith('show_answer')
  expect(screen.queryByText('Yo fui ayer.')).toBeNull()
  view.rerender(<MessageFeedback {...frame} {...base} onControl={control} decision={{ ...decision, exposedMove: 'explicit', shown: { ...decision.shown!, move: 'explicit', text: 'Yo fui ayer.' } }} />)
  expect(within(screen.getByRole('dialog')).getByText('Yo fui ayer.')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Show answer' })).toBeNull()
})
it('retains the card after a failed control and never retries automatically', async () => {
  const control = vi.fn().mockRejectedValue(new Error('Review the changed feedback first.'))
  render(<MessageFeedback {...frame} {...base} onControl={control} />)
  fireEvent.click(screen.getByRole('button', { name: /Coach feedback for message/ }))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Keep going' })))
  expect(screen.getByRole('dialog')).toBeVisible()
  expect(screen.getByRole('alert')).toHaveTextContent('Review the changed feedback first.')
  expect(control).toHaveBeenCalledOnce()
})
it('renders only native Fixed text and keeps continuing optional', async () => {
  const control = vi.fn().mockResolvedValue(undefined)
  render(<MessageFeedback {...frame} {...base} decision={{ ...decision, shown: null, retryInvited: false, fixed: 'Fixed: fui: first-person past', alsoNoticed: [] }} onControl={control} />)
  expect(screen.getByRole('status')).toHaveTextContent('Fixed: fui: first-person past')
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Coach feedback for message/ })))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Keep going' })))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(control).toHaveBeenCalledWith('keep_going')
})
it('distinguishes pending, failed, and missing feedback', () => {
  const props = { ...base, feedback: undefined, decision: undefined, reviewing: true }
  const view = render(<MessageFeedback {...frame} {...props} />)
  expect(screen.getByRole('button', { name: /Coach feedback for message/ })).toHaveTextContent('Analyzing')
  view.rerender(<MessageFeedback {...frame} {...props} reviewing={false} error="Provider unavailable" />)
  expect(screen.getByRole('button', { name: /Coach feedback for message/ })).toHaveTextContent('Feedback failed')
  view.rerender(<MessageFeedback {...frame} {...props} reviewing={false} />)
  expect(screen.getByRole('button', { name: /Coach feedback for message/ })).toHaveTextContent('Feedback unavailable')
})

it('reports uncertain repair without a Fixed claim or invented correction', () => {
  render(<MessageFeedback {...frame} {...base} decision={{ ...decision, shown: null, retryInvited: false, fixed: null, repairStatus: 'uncertain' }} />)
  expect(screen.getByRole('button', { name: /Coach feedback for message/ })).toHaveTextContent('Feedback')
  fireEvent.click(screen.getByRole('button', { name: /Coach feedback for message/ }))
  expect(screen.getByRole('status')).toHaveTextContent('The coach could not confirm this revision yet.')
  expect(screen.queryByText(/Fixed:/)).toBeNull()
  expect(screen.queryByLabelText('Coaching suggestion')).toBeNull()
})

it.each(['Coach feedback for message 3', 'Analyze your message'])('requires durable disclosure through %s before showing help', async label => {
  let complete!: () => void
  const control = vi.fn(() => new Promise<void>(resolve => { complete = resolve }))
  const unexposed = { ...decision, exposedMove: null }
  const view = render(<MessageFeedback {...frame} {...base} decision={unexposed} onControl={control} />)
  fireEvent.click(screen.getByRole('button', { name: label }))
  expect(control).toHaveBeenCalledExactlyOnceWith('open_card')
  expect(screen.queryByText('Which form goes with yo?')).toBeNull()
  await act(async () => complete())
  expect(screen.queryByText('Which form goes with yo?')).toBeNull()
  view.rerender(<MessageFeedback {...frame} {...base} decision={decision} onControl={control} />)
  expect(within(screen.getByRole('dialog')).getByText('Which form goes with yo?')).toBeVisible()
})

it('keeps an unexposed hint hidden on a stale disclosure failure and allows explicit retry', async () => {
  const control = vi.fn().mockRejectedValue(new Error('Coaching is unavailable.'))
  render(<MessageFeedback {...frame} {...base} decision={{ ...decision, exposedMove: null }} onControl={control} />)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Analyze your message' })))
  expect(screen.getByRole('dialog')).toBeVisible()
  expect(screen.queryByText('Which form goes with yo?')).toBeNull()
  expect(screen.getByRole('alert')).toHaveTextContent('Coaching is unavailable.')
  expect(control).toHaveBeenCalledOnce()
  expect(screen.getByRole('button', { name: 'Analyze your message' })).toBeEnabled()
})

it('records disclosure before showing newly arrived feedback in the open dialog', async () => {
  const control = vi.fn().mockResolvedValue(undefined)
  const view = render(<MessageFeedback {...frame} {...base} decision={undefined} feedback={undefined} reviewing onControl={control} />)
  fireEvent.click(screen.getByRole('button', { name: 'Analyze your message' }))
  view.rerender(<MessageFeedback {...frame} {...base} decision={{ ...decision, exposedMove: null }} onControl={control} />)
  expect(screen.queryByText('Which form goes with yo?')).toBeNull()
  await act(async () => {})
  expect(control).toHaveBeenCalledExactlyOnceWith('open_card')
  expect(screen.queryByText('Which form goes with yo?')).toBeNull()
  view.rerender(<MessageFeedback {...frame} {...base} onControl={control} />)
  expect(within(screen.getByRole('dialog')).getByText('Which form goes with yo?')).toBeVisible()
})

it('opens the same modal immediately and keeps errors inside it', async () => {
  const control = vi.fn().mockRejectedValue(new Error('No correction is available.'))
  render(<MessageFeedback {...frame} {...base} decision={{...decision,shown:null}} onControl={control} analysis={<p>Me gusta means I like.</p>} />)
  await act(async () => fireEvent.click(screen.getByRole('button', {name:'Analyze your message'})))
  expect(screen.getByRole('dialog')).toHaveTextContent('Me gusta means I like.')
  expect(screen.getByRole('dialog')).toHaveTextContent('No correction is available.')
  expect(screen.getByRole('button', {name:'Coach feedback for message 3'})).not.toHaveTextContent('Reviewed')
})

const feedbackStates: [string, CoachDecision][] = [
  ['retry invited', decision],
  ['suggestion', { ...decision, retryInvited: false }],
  ['fixed', { ...decision, fixed: 'Fixed: fui', shown: null }],
  ['uncertain', { ...decision, repairStatus: 'uncertain', shown: null }],
  ['continued', { ...decision, keptGoing: true, shown: null }],
  ['no correction', { ...decision, retryInvited: false, shown: null }],
]
it.each(feedbackStates)('keeps feedback and editing neutral when %s', (_state, currentDecision) => {
  const edit = vi.fn()
  render(<MessageFeedback {...frame} {...base} decision={currentDecision} onEdit={edit} />)
  const chip = screen.getByRole('button', { name: 'Coach feedback for message 3' })
  expect(chip).toHaveTextContent(currentDecision?.shown ? '1 error' : currentDecision?.repairStatus === 'uncertain' ? 'Feedback' : 'Good job')
  fireEvent.click(chip)
  expect(screen.getByRole('dialog')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Edit and resend message' }))
  expect(edit).toHaveBeenCalledOnce()
  expect(screen.queryByRole('dialog')).toBeNull()
})


it('uses the shared Ask action and closes feedback before handing off its question', () => {
  const ask = vi.fn()
  render(<MessageFeedback {...frame} {...base} onAsk={ask} />)
  fireEvent.click(screen.getByRole('button', { name: 'Analyze your message' }))
  fireEvent.click(screen.getByRole('button', { name: 'Ask the coach' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(ask).toHaveBeenCalledWith(expect.stringContaining('Help me understand the feedback on my message:'))
})

it('closes both feedback and nested token details when asking about a token', () => {
  const ask = vi.fn()
  render(<MessageFeedback {...frame} {...base} onAsk={ask} analysis={<SavedGlossText text="Hola" segments={[{ start: 0, end: 4, kind: 'gloss', gloss: 'hello' }]} />} />)
  fireEvent.click(screen.getByRole('button', { name: 'Analyze your message' }))
  fireEvent.click(screen.getByRole('button', { name: 'Hola' }))
  const help = screen.getByRole('group', { name: 'Word help' })
  fireEvent.click(within(help).getByRole('button', { name: 'Ask the coach' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.queryByRole('group', { name: 'Word help' })).toBeNull()
  expect(ask).toHaveBeenCalledTimes(1)
  expect(ask).toHaveBeenCalledWith(expect.stringContaining('Help me understand “Hola”'))
})

it('keeps rich corrections and clarification in the feedback window alongside scores', async () => {
  const onAsk = vi.fn()
  const onAddContext = vi.fn().mockResolvedValue(undefined)
  const direct = { ...decision, exposedMove: 'explicit' as const, shown: { construct: 'past', quote: 'yo cocina', move: 'explicit' as const, text: 'yo cociné', explanation: 'Use cociné for a completed action yesterday.' } }
  const view = render(<MessageFeedback {...frame} {...base} decision={direct} conversationFeedback={{ grammar: 6, conversation: 10, answers: {} }} onAsk={onAsk} onAddContext={onAddContext} />)
  fireEvent.click(screen.getByRole('button', { name: /Coach feedback for message/ }))
  expect(view.container.ownerDocument.querySelector('del.cor-removed')).toHaveTextContent('yo cocina')
  expect(view.container.ownerDocument.querySelector('.cor-replacement')).toHaveTextContent('yo cociné')
  expect(screen.getByText('Use cociné for a completed action yesterday.')).toBeVisible()
  expect(screen.queryByText('Explain scores')).toBeNull()
  const input = screen.getByRole('textbox', { name: 'Add context' })
  expect(input).toBeVisible()
  fireEvent.change(input, { target: { value: 'I meant yesterday.' } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Reassess with context' })))
  expect(onAddContext).toHaveBeenCalledExactlyOnceWith('I meant yesterday.')
  expect(onAsk).not.toHaveBeenCalled()
  expect(screen.getByRole('dialog')).toBeVisible()
})

it('reveals feedback that finishes while its window is already open', async () => {
  const control = vi.fn().mockResolvedValue(undefined)
  const view = render(<MessageFeedback {...frame} {...base} decision={undefined} feedback={undefined} reviewing onControl={control} />)
  fireEvent.click(screen.getByRole('button', { name: /Coach feedback for message/ }))
  view.rerender(<MessageFeedback {...frame} {...base} decision={{ ...decision, exposedMove: null }} onControl={control} />)
  await act(async () => {})
  expect(control).toHaveBeenCalledExactlyOnceWith('open_card')
})

it('places skill details after coaching corrections', () => {
  render(<MessageFeedback {...frame} {...base} skills={<details><summary>Skills</summary>Evidence</details>} />)
  fireEvent.click(screen.getByRole('button', { name: 'Analyze your message' }))
  const hint = within(screen.getByRole('dialog')).getByText('Which form goes with yo?')
  const skills = screen.getByText('Skills')
  expect(hint.compareDocumentPosition(skills) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(skills.closest('details')).not.toHaveAttribute('open')
})

it('leads the scored line with a verdict and rings, and Fix it opens the message for editing', () => {
  const onEdit = vi.fn()
  const scores = { grammar: 6, conversation: 6, answers: {} } as never
  const view = render(<MessageFeedback {...frame} {...base} onEdit={onEdit} conversationFeedback={scores} />)
  const badge = screen.getByRole('button', { name: /Coach feedback for message/ })
  expect(badge).toHaveTextContent('1 error')
  fireEvent.click(screen.getByRole('button', { name: 'Fix it' }))
  expect(onEdit).toHaveBeenCalledOnce()
  view.rerender(<MessageFeedback {...frame} {...base} onEdit={onEdit} conversationFeedback={scores} decision={{ ...decision, shown: null }} />)
  expect(badge).toHaveTextContent('Good job')
  expect(screen.queryByRole('button', { name: 'Fix it' })).toBeNull()
  view.rerender(<MessageFeedback {...frame} {...base} onEdit={onEdit} conversationFeedback={scores} decision={{ ...decision, shown: null }}
    feedback={{ ...feedback, items: [{ construct: 'a', quote: 'Yo', outcome: 'partial', rationale: '' }, { construct: 'b', quote: 'ayer', outcome: 'not_demonstrated', rationale: '' }] }} />)
  expect(badge).toHaveTextContent('2 errors')
})
