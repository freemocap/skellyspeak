// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ConversationStart } from './ConversationStart'
const starters = [{ id: 'food', label: 'Ordering food', reason: 'From your focus', preview: 'Quiero café.', translation: 'I want coffee.' }]
it('offers one action with no phrase previews or explanation clutter', async () => {
  const start = vi.fn().mockResolvedValue(undefined)
  render(<ConversationStart starters={starters} busy={false} onStart={start} />)
  expect(screen.getAllByRole('button')).toHaveLength(1)
  expect(screen.queryByText('Quiero café.')).toBeNull()
  expect(screen.queryByText('From your focus')).toBeNull()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Let partner start' })))
  expect(start).toHaveBeenCalledWith({ kind: 'surprise' })
})
it('selecting a topic does not start until the button is pressed', async () => {
  const start = vi.fn().mockResolvedValue(undefined)
  render(<ConversationStart starters={starters} busy={false} onStart={start} />)
  fireEvent.change(screen.getByRole('combobox', { name: 'Topic' }), { target: { value: 'food' } })
  expect(start).not.toHaveBeenCalled()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Let partner start' })))
  expect(start).toHaveBeenCalledWith({ kind: 'starter', starterId: 'food' })
})
it('keeps the topic and displays a failed start without retrying', async () => {
  const start = vi.fn().mockRejectedValue(new Error('Conversation already started.'))
  render(<ConversationStart starters={starters} busy={false} onStart={start} />)
  fireEvent.change(screen.getByRole('combobox', { name: 'Topic' }), { target: { value: 'food' } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Let partner start' })))
  expect(screen.getByRole('combobox')).toHaveValue('food')
  expect(screen.getByRole('alert')).toHaveTextContent('Conversation already started.')
  expect(start).toHaveBeenCalledOnce()
})
it('disables both controls while a start is in flight', async () => {
  const start = vi.fn(() => new Promise<void>(() => {}))
  render(<ConversationStart starters={starters} busy={false} onStart={start} />)
  fireEvent.click(screen.getByRole('button', { name: 'Let partner start' }))
  expect(screen.getByRole('button', { name: 'Starting…' })).toBeDisabled()
  expect(screen.getByRole('combobox')).toBeDisabled()
  expect(start).toHaveBeenCalledOnce()
})
