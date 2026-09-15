// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { ConversationSnapshot, TurnView } from '../../contracts'
import { replyState } from '../../domain/language/reply-state'
import { ReplyStatus } from './ReplyStatus'
function execution(state: string, turnState = state): TurnView {
  return { id: 'turn', state: turnState, paused: false, hold: null, operations: [{ id: 'reply', kind: 'persona_reply', state }], attempts: [{ operationId: 'coach', error: 'Independent coach error' }, { operationId: 'reply', error: 'Provider rejected reply' }] } as TurnView
}
function project(turn: TurnView, paused = false) {
  return replyState(turn, { turns: [turn], connection: { paused } } as ConversationSnapshot)
}
it.each(['failed', 'unknown', 'cancelled', 'invalidated', 'succeeded'])('does not show progress for terminal reply %s', state => {
  render(<ReplyStatus reply={project(execution(state))} />)
  expect(screen.queryByText('Thinking…')).toBeNull()
  expect(screen.queryByText('Independent coach error')).toBeNull()
})
it('treats holds and both pause gates as stopped, even while turn state remains pending', () => {
  const held = execution('ready', 'pending'); held.hold = { message: 'Budget held' } as TurnView['hold']
  expect(project(held)).toMatchObject({ state: 'held', error: 'Budget held', control: 'resume' })
  const paused = execution('ready', 'pending'); paused.paused = true
  expect(project(paused)).toMatchObject({ state: 'paused', control: 'resume' })
  expect(project(paused, true)).toMatchObject({ state: 'paused', control: null })
  expect(project(execution('running', 'pending'))).toMatchObject({ state: 'pending', control: null })
  expect(replyState(undefined, { turns: [], connection: { paused: false } } as unknown as ConversationSnapshot)).toMatchObject({ state: 'unavailable', control: null })
})
it('does not offer retry for an earlier exchange or cancelled work', () => {
  const turn = execution('failed')
  expect(replyState(turn, { turns: [execution('running', 'pending'), turn].map((item, i) => ({ ...item, id: i ? 'turn' : 'later' })), connection: { paused: false } } as ConversationSnapshot).control).toBeNull()
  expect(project(execution('cancelled')).control).toBeNull()
})
it('retries explicitly once, surfaces admission rejection, and only displays progress from a subsequent native state', async () => {
  let reject!: (reason: Error) => void
  const control = vi.fn(() => new Promise<void>((_, no) => { reject = no }))
  const view = render(<ReplyStatus reply={project(execution('failed'))} onControl={control} />)
  expect(control).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Retry exchange' }))
  fireEvent.click(screen.getByRole('button', { name: 'Retry exchange' }))
  expect(control).toHaveBeenCalledExactlyOnceWith('retry')
  expect(screen.queryByText('Thinking…')).toBeNull()
  await act(async () => reject(new Error('Connection changed')))
  await waitFor(() => expect(screen.getByText('Connection changed')).toBeVisible())
  view.rerender(<ReplyStatus reply={project(execution('running', 'pending'))} onControl={control} />)
  expect(screen.getByText('Thinking…')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Retry exchange' })).toBeNull()
})
