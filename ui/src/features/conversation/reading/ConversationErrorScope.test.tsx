// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { TurnView } from '../../../generated/contracts'
import { ErrorDetails } from '../../../components/feedback/ErrorDetails'
import { useNavigationStore } from '../../../state/navigation/navigation'
import { ConversationErrorScope } from './ConversationErrorScope'

it('opens the originating operation, even with several failures and an older exchange', () => {
  const turn = { id: 'older-turn', operations: [{id:'gloss',kind:'word_gloss',state:'failed'}, {id:'help',kind:'reply_assistance',state:'failed'}], attempts: [{operationId:'help',error:'romanization is not in Latin script'}] } as TurnView
  const close = vi.fn()
  render(<ConversationErrorScope conversationId="conversation" turn={turn} onInspect={close}>
    <ErrorDetails label="Reply ideas" errorKey='["romanization is not in Latin script"]'>romanization is not in Latin script</ErrorDetails>
  </ConversationErrorScope>)
  fireEvent.click(screen.getByText('⚠ Reply ideas'))
  fireEvent.click(screen.getByRole('button', {name:'Open AI activity'}))
  expect(close).toHaveBeenCalledOnce()
  expect(useNavigationStore.getState().overlay).toBe('activity')
  expect(useNavigationStore.getState().aiInspection).toEqual({conversationId:'conversation',turnId:'older-turn',operationKind:'reply_assistance'})
})
