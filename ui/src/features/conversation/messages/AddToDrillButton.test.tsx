// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ReadingScopeContext } from '../../../components/reading/ReadingContext'
import { createDrillItem } from '../../../platform/ipc/drill'
import { AddToDrillButton } from './AddToDrillButton'
import { TurnView } from './TurnView'

vi.mock('../../../platform/ipc/tauri', async importOriginal => ({ ...await importOriginal<typeof import('../../../platform/ipc/tauri')>(), languageFor: () => ({ languageTag: 'es', direction: 'ltr', fontScale: 1 }) }))
vi.mock('../../../platform/ipc/drill', () => ({ createDrillItem: vi.fn() }))
const create = vi.mocked(createDrillItem)
const scope = { language: 'spanish', variety: 'spanish-mexico', explanation: 'english', explanationVariety: 'english-us' }
beforeEach(() => create.mockReset())

it('puts one add action on the completed AI bubble and uses its captured language scope', async () => {
  create.mockResolvedValue({ id: 'phrase-1' } as Awaited<ReturnType<typeof createDrillItem>>)
  const { container } = render(<ReadingScopeContext value={scope}><TurnView turn={{ id: 1, user: 'Hola', pendingText: '', assistant: {
    reply: 'Buenos días.', tokens: [], user_tokens: [], translation: '', user_translation: '', mechanics: [], scaffolds: { replies: [], frames: [], starters: [] }, errors: [],
  } }} reviewing={false} focused={false} ttsReady={false} speaking={false} rtl={false} onBubbleTap={() => {}} onAskCoach={() => {}} /></ReadingScopeContext>)
  expect(within(container.querySelector('.msg.me') as HTMLElement).queryByRole('button', { name: 'Add to Drill' })).toBeNull()
  fireEvent.click(within(container.querySelector('.msg.bot') as HTMLElement).getByRole('button', { name: 'Add to Drill' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Added to Drill' })).toBeDisabled())
  expect(create).toHaveBeenCalledExactlyOnceWith({ text: 'Buenos días.', ...scope })
})

it('blocks repeated clicks during a save and after success', async () => {
  let finish!: (value: Awaited<ReturnType<typeof createDrillItem>>) => void
  create.mockReturnValue(new Promise(resolve => { finish = resolve }))
  render(<ReadingScopeContext value={scope}><AddToDrillButton text="Hola" /></ReadingScopeContext>)
  const button = screen.getByRole('button', { name: 'Add to Drill' })
  fireEvent.click(button); fireEvent.click(button)
  expect(button).toBeDisabled()
  expect(create).toHaveBeenCalledTimes(1)
  finish({ id: 'phrase-1' } as Awaited<ReturnType<typeof createDrillItem>>)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Added to Drill' })).toBeDisabled())
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
  await screen.findByRole('button', { name: 'Added to Drill' })
  expect(screen.queryByRole('alert')).toBeNull()
})

it('does not guess a language when the conversation scope is unavailable', () => {
  render(<AddToDrillButton text="Hola" />)
  expect(screen.queryByRole('button')).toBeNull()
  expect(create).not.toHaveBeenCalled()
})
