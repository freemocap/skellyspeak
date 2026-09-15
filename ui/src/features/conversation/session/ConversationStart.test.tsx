// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ConversationStart } from './ConversationStart'
const starters = [{ id: 'food', label: 'Ordering food', reason: 'From your focus', preview: 'Quiero café.', translation: 'I want coffee.' }]
it('starts a surprise conversation without requiring topic selection', async () => {
  const start = vi.fn().mockResolvedValue(undefined)
  render(<ConversationStart starters={starters} busy={false} onStart={start} />)
  expect(screen.queryByText('Quiero café.')).toBeNull()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Let partner start' })))
  expect(start).toHaveBeenCalledWith({ kind: 'surprise' })
})
it('starts directly from a native topic card', async () => {
  const start = vi.fn().mockResolvedValue(undefined)
  render(<ConversationStart starters={starters} busy={false} onStart={start} />)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Ordering food/ })))
  expect(start).toHaveBeenCalledExactlyOnceWith({ kind: 'starter', starterId: 'food' })
})
it('displays a failed topic start without retrying', async () => {
  const start = vi.fn().mockRejectedValue(new Error('Conversation already started.'))
  render(<ConversationStart starters={starters} busy={false} onStart={start} />)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Ordering food/ })))
  expect(screen.getByRole('alert')).toHaveTextContent('Conversation already started.')
  expect(start).toHaveBeenCalledOnce()
})
it('blocks duplicate starts across both entry points while in flight', () => {
  const start = vi.fn(() => new Promise<void>(() => {}))
  render(<ConversationStart starters={starters} busy={false} onStart={start} />)
  fireEvent.click(screen.getByRole('button', { name: 'Let partner start' }))
  expect(screen.getByRole('button', { name: 'Starting…' })).toBeDisabled()
  expect(screen.getByRole('button', { name: /Ordering food/ })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: /Ordering food/ }))
  expect(start).toHaveBeenCalledOnce()
})
