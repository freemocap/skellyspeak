// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, expect, it, vi } from 'vitest'
import { ConversationFeedbackCard } from './ConversationFeedbackCard'
import { MessageFeedback } from './MessageFeedback'
beforeAll(() => { HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }; HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') } })
const feedback = { grammar: 0, conversation: 10, answers: {} }
it('renders supplementary scores without redirecting to chat',()=>{
 const ask=vi.fn();render(<ConversationFeedbackCard feedback={feedback}/>);
 expect(screen.getByRole('meter',{name:'Grammar'})).toHaveAttribute('aria-valuenow','0');expect(screen.getByRole('meter',{name:'Conversation fit'})).toHaveAttribute('aria-valuemax','10');expect(ask).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:'Explain scores'})).toBeNull();
});
it('represents insufficient evidence without a zero meter',()=>{
 render(<ConversationFeedbackCard feedback={{...feedback,grammar:null}}/>);expect(screen.queryByRole('meter',{name:'Grammar'})).toBeNull();expect(screen.getByText('Insufficient evidence')).toBeVisible();
});
it('opens saved scores without requesting more inference or revealing retired commentary',()=>{
 const control=vi.fn();render(<MessageFeedback id={1} text="Source" conversationFeedback={feedback} feedback={undefined} error={undefined} reviewing={false} onEdit={undefined} onAsk={vi.fn()} onControl={control}/>);
 const badge=screen.getByRole('button',{name:'Coach feedback for message 1'});expect(badge).toHaveAccessibleDescription('Grammar: 0/10 Conversation fit: 10/10');fireEvent.click(badge);expect(screen.getByRole('dialog')).toBeVisible();expect(control).not.toHaveBeenCalled();
});
