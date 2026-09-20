// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ConversationStart } from './ConversationStart'
import type { ConversationStartConfig, TopicCard } from '../../../generated/contracts'
const topics: TopicCard[] = [{ id: 'food', glyph: '☕', target: 'الطعام والشراب', romanized: 'aṭ-ṭaʿām wa-al-sharāb', translation: 'Food and drink' }]
const greeting = { text: 'مرحبا', romanized: 'marḥaban' }
const value: ConversationStartConfig = { difficulty: 'beginner', varietyId: 'arabic-levantine', direction: { topic: null, timeReference: 'any', usePersonaDetails: true } }
const props = {
  topics, greeting, busy: false, conversationId: 'conversation', value, onChange: vi.fn(),
  recording: false, transcribing: false, canPartnerStart: true, onRecord: vi.fn(),
}
it('starts without requiring a topic selection', async () => {
  const start = vi.fn().mockResolvedValue(undefined)
  render(<ConversationStart {...props} onStart={start} />)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Let partner start' })))
  expect(start).toHaveBeenCalledExactlyOnceWith(value)
})
it('time and difficulty choices only update the draft', async () => {
  const start = vi.fn()
  const change = vi.fn()
  render(<ConversationStart {...props} onStart={start} onChange={change} />)
  fireEvent.click(screen.getByRole('button', { name: 'Past events' }))
  expect(change).toHaveBeenLastCalledWith({ ...value, direction: { ...value.direction, timeReference: 'past' } })
  await act(async () => fireEvent.change(screen.getByRole('combobox', { name: 'Difficulty' }), { target: { value: 'absolute_zero' } }))
  expect(change).toHaveBeenLastCalledWith({ ...value, difficulty: 'absolute_zero' })
  expect(start).not.toHaveBeenCalled()
})
it('starts immediately with the clicked topic and current settings', async () => {
  const start = vi.fn().mockResolvedValue(undefined)
  const selected = { ...value, difficulty: 'advanced' as const }
  render(<ConversationStart {...props} value={selected} onStart={start} />)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /الطعام والشراب/ })))
  expect(start).toHaveBeenCalledExactlyOnceWith({ ...selected, direction: { ...selected.direction, topic: { kind: 'builtin', id: 'food' } } })
})
it('names each scene in the target language, romanized, and in the explanation language', () => {
  render(<ConversationStart {...props} onStart={vi.fn()} targetTag="ar" targetDir="rtl" />)
  const card = screen.getByRole('button', { name: /الطعام والشراب/ })
  // Romanization is Latin inside an Arabic card and must say so itself.
  expect(card.querySelector('.scene-roman bdi')).toHaveAttribute('dir', 'ltr')
  expect(card.querySelector('.scene-label bdi')).toHaveAttribute('dir', 'rtl')
  expect(card).toHaveTextContent('Food and drink')
})
it('offers the authored greeting and only opens the recorder with it', () => {
  const record = vi.fn()
  const start = vi.fn()
  render(<ConversationStart {...props} onStart={start} onRecord={record} />)
  fireEvent.click(screen.getByRole('button', { name: 'Say مرحبا' }))
  expect(record).toHaveBeenCalledOnce()
  // Recording must not admit the conversation; only sending does.
  expect(start).not.toHaveBeenCalled()
})
it('withholds the partner-first start while a draft or the microphone is in use', () => {
  const { rerender } = render(<ConversationStart {...props} onStart={vi.fn()} canPartnerStart={false} />)
  expect(screen.getByRole('button', { name: 'Let partner start' })).toBeDisabled()
  expect(screen.getByRole('button', { name: /الطعام والشراب/ })).toBeDisabled()
  rerender(<ConversationStart {...props} onStart={vi.fn()} recording={true} />)
  expect(screen.getByRole('button', { name: 'Let partner start' })).toBeDisabled()
  // The same control stops the recording it started.
  expect(screen.getByRole('button', { name: 'Stop' })).toBeEnabled()
  expect(screen.getByRole('button', { name: /الطعام والشراب/ })).toBeDisabled()
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
  expect(screen.getByRole('button', { name: /الطعام والشراب/ })).toBeDisabled()
  expect(screen.getByRole('combobox', { name: 'Difficulty' })).toBeDisabled()
  expect(start).toHaveBeenCalledOnce()
})
