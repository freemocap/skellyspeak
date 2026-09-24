// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ReadingScopeContext } from '../../../components/reading/ReadingContext'
import { createDrillItem, deleteDrillItem } from '../../../platform/ipc/drill'
import { AddToDrillButton } from './AddToDrillButton'
import { TurnView } from './TurnView'

vi.mock('../../../platform/ipc/tauri', async importOriginal => ({ ...await importOriginal<typeof import('../../../platform/ipc/tauri')>(), languageFor: () => ({ languageTag: 'es', direction: 'ltr', fontScale: 1 }) }))
vi.mock('../../../platform/ipc/drill', () => ({ createDrillItem: vi.fn(), deleteDrillItem: vi.fn() }))
const create = vi.mocked(createDrillItem)
const remove = vi.mocked(deleteDrillItem)
const scope = { language: 'spanish', variety: 'spanish-mexico', explanation: 'english', explanationVariety: 'english-us' }
beforeEach(() => { create.mockReset(); remove.mockReset() })

it('puts one add action on each bubble and saves the AI reply with its captured language scope', async () => {
  create.mockResolvedValue({ id: 'phrase-1' } as Awaited<ReturnType<typeof createDrillItem>>)
  const { container } = render(<ReadingScopeContext value={scope}><TurnView turn={{ id: 1, user: 'Hola', pendingText: '', assistant: {
    reply: 'Buenos días.', tokens: [], user_tokens: [], translation: '', user_translation: '', mechanics: [], scaffolds: { replies: [], frames: [], starters: [] }, errors: [],
  } }} reviewing={false} focused={false} ttsReady={false} speaking={false} rtl={false} onBubbleTap={() => {}} onAskCoach={() => {}} /></ReadingScopeContext>)
  expect(within(container.querySelector('.msg.me') as HTMLElement).getAllByRole('button', { name: 'Add to Drill' })).toHaveLength(1)
  expect(within(container.querySelector('.msg.bot') as HTMLElement).getAllByRole('button', { name: 'Add to Drill' })).toHaveLength(1)
  fireEvent.click(within(container.querySelector('.msg.bot') as HTMLElement).getByRole('button', { name: 'Add to Drill' }))
  await screen.findByRole('button', { name: 'Remove from Drill' })
  expect(create).toHaveBeenCalledExactlyOnceWith({ text: 'Buenos días.', ...scope })
})

it('blocks repeated clicks while a save is in flight', async () => {
  let finish!: (value: Awaited<ReturnType<typeof createDrillItem>>) => void
  create.mockReturnValue(new Promise(resolve => { finish = resolve }))
  render(<ReadingScopeContext value={scope}><AddToDrillButton text="Hola" /></ReadingScopeContext>)
  const button = screen.getByRole('button', { name: 'Add to Drill' })
  fireEvent.click(button); fireEvent.click(button)
  expect(button).toBeDisabled()
  expect(create).toHaveBeenCalledTimes(1)
  finish({ id: 'phrase-1' } as Awaited<ReturnType<typeof createDrillItem>>)
  expect(await screen.findByRole('button', { name: 'Remove from Drill' })).toBeEnabled()
})

it('keeps a failed save visible and permits an explicit retry without truncating text', async () => {
  create.mockRejectedValueOnce(new Error('Enter between 1 and 512 characters to practise.'))
  create.mockResolvedValueOnce({ id: 'phrase-1' } as Awaited<ReturnType<typeof createDrillItem>>)
  const text = 'Long reply. '.repeat(60)
  render(<ReadingScopeContext value={scope}><AddToDrillButton text={text} /></ReadingScopeContext>)
  fireEvent.click(screen.getByRole('button', { name: 'Add to Drill' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('512')
  expect(create).toHaveBeenLastCalledWith({ text, ...scope })
  fireEvent.click(screen.getByRole('button', { name: 'Add to Drill' }))
  await screen.findByRole('button', { name: 'Remove from Drill' })
  expect(screen.queryByRole('alert')).toBeNull()
})

it('does not guess a language when the conversation scope is unavailable', () => {
  render(<AddToDrillButton text="Hola" />)
  expect(screen.queryByRole('button')).toBeNull()
  expect(create).not.toHaveBeenCalled()
})

it('saves the learner message from its own bubble', async () => {
  create.mockResolvedValue({ id: 'phrase-2' } as Awaited<ReturnType<typeof createDrillItem>>)
  const { container } = render(<ReadingScopeContext value={scope}><TurnView turn={{ id: 1, user: 'Hola', pendingText: '', assistant: null }} reviewing={false} focused={false} ttsReady={false} speaking={false} rtl={false} onBubbleTap={() => {}} onAskCoach={() => {}} /></ReadingScopeContext>)
  fireEvent.click(within(container.querySelector('.msg.me') as HTMLElement).getByRole('button', { name: 'Add to Drill' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Remove from Drill' })).toHaveAttribute('data-state', 'saved'))
  expect(create).toHaveBeenCalledExactlyOnceWith({ text: 'Hola', ...scope })
})

it('removes the saved item on a second press and can add it again', async () => {
  create.mockResolvedValueOnce({ id: 'phrase-1' } as Awaited<ReturnType<typeof createDrillItem>>)
  create.mockResolvedValueOnce({ id: 'phrase-2' } as Awaited<ReturnType<typeof createDrillItem>>)
  remove.mockResolvedValue(undefined)
  render(<ReadingScopeContext value={scope}><AddToDrillButton text="Hola" /></ReadingScopeContext>)
  fireEvent.click(screen.getByRole('button', { name: 'Add to Drill' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Remove from Drill' }))
  expect(await screen.findByRole('button', { name: 'Add to Drill' })).toHaveAttribute('data-state', 'ready')
  expect(remove).toHaveBeenCalledExactlyOnceWith('phrase-1')
  fireEvent.click(screen.getByRole('button', { name: 'Add to Drill' }))
  await screen.findByRole('button', { name: 'Remove from Drill' })
  expect(create).toHaveBeenCalledTimes(2)
})

it('keeps the item saved and shows the failure when removal fails', async () => {
  create.mockResolvedValue({ id: 'phrase-1' } as Awaited<ReturnType<typeof createDrillItem>>)
  remove.mockRejectedValue(new Error('This drill item no longer exists.'))
  render(<ReadingScopeContext value={scope}><AddToDrillButton text="Hola" /></ReadingScopeContext>)
  fireEvent.click(screen.getByRole('button', { name: 'Add to Drill' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Remove from Drill' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('no longer exists')
  expect(screen.getByRole('button', { name: 'Remove from Drill' })).toHaveAttribute('data-state', 'saved')
})
