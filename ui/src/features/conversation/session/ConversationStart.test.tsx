// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ConversationStart } from './ConversationStart'
import type { ConversationStartConfig } from '../../../generated/contracts'
const topics = [{ id: 'food', label: 'Ordering food' }]
const value: ConversationStartConfig = { difficulty: 'beginner', varietyId: 'arabic-levantine', direction: { topic: null, timeReference: 'any', usePersonaDetails: true } }
const props = { topics, busy: false, conversationId: 'conversation', value, onChange: vi.fn() }
it('starts without requiring a topic selection', async () => {
  const start = vi.fn().mockResolvedValue(undefined)
  render(<ConversationStart {...props} onStart={start} />)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Let partner start' })))
  expect(start).toHaveBeenCalledExactlyOnceWith()
})
it('topic, time and difficulty choices only update the draft', async () => {
  const start = vi.fn()
  const change = vi.fn()
  render(<ConversationStart {...props} onStart={start} onChange={change} />)
  fireEvent.click(screen.getByRole('button', { name: 'Ordering food' }))
  expect(change).toHaveBeenLastCalledWith({ ...value, direction: { ...value.direction, topic: { kind: 'builtin', id: 'food' } } })
  fireEvent.click(screen.getByRole('button', { name: 'Past events' }))
  expect(change).toHaveBeenLastCalledWith({ ...value, direction: { ...value.direction, timeReference: 'past' } })
  await act(async () => fireEvent.change(screen.getByRole('combobox', { name: 'Difficulty' }), { target: { value: 'absolute_zero' } }))
  expect(change).toHaveBeenLastCalledWith({ ...value, difficulty: 'absolute_zero' })
  expect(start).not.toHaveBeenCalled()
})
it('displays failed starts without automatic retry', async () => {
  const start = vi.fn().mockRejectedValue(new Error('Conversation already started.'))
  render(<ConversationStart {...props} onStart={start} />)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Let partner start' })))
  expect(screen.getByRole('alert')).toHaveTextContent('Conversation already started.')
  expect(start).toHaveBeenCalledOnce()
})
it('blocks duplicate starts and setting changes while in flight', () => {
  const start = vi.fn(() => new Promise<void>(() => {}))
  render(<ConversationStart {...props} onStart={start} />)
  fireEvent.click(screen.getByRole('button', { name: 'Let partner start' }))
  expect(screen.getByRole('button', { name: 'Starting…' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Ordering food' })).toBeDisabled()
  expect(screen.getByRole('combobox', { name: 'Difficulty' })).toBeDisabled()
  expect(start).toHaveBeenCalledOnce()
})
