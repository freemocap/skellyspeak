// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, expect, it, vi } from 'vitest'
import { ConversationFeedbackCard } from './ConversationFeedbackCard'
import { MessageFeedback } from './MessageFeedback'
import type { MessageTool } from '../../../components/reading/MessageTools'

/** The message bubble and reward the owner supplies: here, just the Analysis tool as a button. */
const frame = { reward: null, bubble: (tool: MessageTool) => <button type="button" aria-label={tool.ariaLabel} onClick={tool.onSelect}>{tool.label}</button> }
beforeAll(() => { HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }; HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') } })
const feedback = { grammar: 0, conversation: 10, answers: {} }
const categorical = { grammar: null, conversation: null, answers: {
 grammar: { choice: 'local_errors', confidence: 0.65, probabilities: { acceptable: 0.1, local_errors: 0.7, major_errors: 0.15, insufficient_evidence: 0.05 } },
 understandability: { choice: 'understandable', confidence: 0.8, probabilities: { understandable: 0.8, needs_clarification: 0.1, unrecoverable: 0.05, insufficient_evidence: 0.05 } },
} }
it('shows categorical judgments and discloses the saved distribution without a numeric grade', () => {
 render(<ConversationFeedbackCard feedback={categorical} />)
 expect(screen.queryByRole('meter')).toBeNull()
 expect(screen.getByText('Local errors', { selector: 'strong' })).toBeVisible()
 expect(screen.getByText('Understood', { selector: 'strong' })).toBeVisible()
 const details = screen.getAllByText('Assessment details')[0].closest('details')!
 expect(details).not.toHaveAttribute('open')
 fireEvent.click(within(details).getByText('Assessment details'))
 expect(details).toHaveAttribute('open')
 expect(within(details).getByText('Model confidence: 65%')).toBeVisible()
 expect(within(details).getByRole('cell', { name: '70%' })).toBeVisible()
})
it('shows abstention as insufficient evidence without treating it as a zero score', () => {
 render(<ConversationFeedbackCard feedback={{ ...categorical, answers: { ...categorical.answers, grammar: { ...categorical.answers.grammar, choice: 'insufficient_evidence' } } }} />)
 expect(screen.getByText('Insufficient evidence', { selector: 'strong' })).toBeVisible()
 expect(screen.queryByRole('meter')).toBeNull()
})
it('opens saved judgments without an inference request or a contradictory missing-feedback notice', () => {
 const control = vi.fn()
 render(<MessageFeedback {...frame} id={1} text="Source" conversationFeedback={categorical} feedback={undefined} error={undefined} reviewing={false} onEdit={undefined} onAsk={vi.fn()} onControl={control} />)
 fireEvent.click(screen.getByRole('button', { name: 'Coach feedback for message 1' }))
 expect(screen.getByText('Understood', { selector: 'strong' })).toBeVisible()
 expect(screen.queryByText('No feedback was saved for this message.')).toBeNull()
 expect(control).not.toHaveBeenCalled()
})
it('renders supplementary scores without redirecting to chat',()=>{
 const ask=vi.fn();render(<ConversationFeedbackCard feedback={feedback}/>);
 expect(screen.getByRole('meter',{name:'Grammar'})).toHaveAttribute('aria-valuenow','0');expect(screen.getByRole('meter',{name:'Conversation fit'})).toHaveAttribute('aria-valuemax','10');expect(ask).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:'Explain scores'})).toBeNull();
});
it('represents insufficient evidence without a zero meter',()=>{
 render(<ConversationFeedbackCard feedback={{...feedback,grammar:null}}/>);expect(screen.queryByRole('meter',{name:'Grammar'})).toBeNull();expect(screen.getByText('Insufficient evidence')).toBeVisible();
});
it('opens saved scores without requesting more inference or revealing retired commentary',()=>{
 const control=vi.fn();render(<MessageFeedback {...frame} id={1} text="Source" conversationFeedback={feedback} feedback={undefined} error={undefined} reviewing={false} onEdit={undefined} onAsk={vi.fn()} onControl={control}/>);
 const badge=screen.getByRole('button',{name:'Coach feedback for message 1'});fireEvent.click(badge);expect(screen.getByRole('dialog')).toBeVisible();expect(control).not.toHaveBeenCalled();
});

it('presents grammar and partner understanding as separate checks with generic meanings, not reasons', () => {
 const view = render(<ConversationFeedbackCard feedback={{ ...categorical, answers: { ...categorical.answers, understandability: { ...categorical.answers.understandability, choice: 'needs_clarification' } } }} />)
 expect(screen.getByText('Each check is judged on its own and can differ from the coach’s suggestion.')).toBeVisible()
 expect(screen.getByText('Partner understanding')).toBeVisible()
 expect(screen.getByText('Needs clarification', { selector: 'strong' })).toBeVisible()
 expect(screen.getByText('Your partner can follow part of it but would need something clarified.')).toBeVisible()
 expect(screen.getByText('Some grammar errors, but the main construction can still be followed.')).toBeVisible()
 expect(view.container.querySelectorAll('.coach-score[data-tone=mixed]')).toHaveLength(2)
})
