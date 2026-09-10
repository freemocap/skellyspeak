// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatHistory } from './ChatHistory'
import type { ChatSummary } from '../types'

const NOW = Math.floor(Date.now() / 1000)

const chat = (over: Partial<ChatSummary> = {}): ChatSummary => ({
  id: '1788400000-aaaa',
  title: 'Ordering coffee',
  updated_at: NOW - 120,
  turn_count: 4,
  ...over,
})

function setup(chats: ChatSummary[], currentId: string | null = null, open = true) {
  const handlers = {
    onClose: vi.fn(),
    onOpenChat: vi.fn(),
    onNewChat: vi.fn(),
    onDeleteChat: vi.fn(),
  }
  render(
    <ChatHistory
      open={open}
      chats={chats}
      currentId={currentId}
      languageName="Español"
      {...handlers}
    />
  )
  return { ...handlers, user: userEvent.setup() }
}

describe('the drawer', () => {
  it('renders nothing at all when closed', () => {
    setup([chat()], null, false)
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  it('says which language these conversations belong to', () => {
    // A Spanish list and an Arabic list are different practice; the header is
    // what stops them being mistaken for one another.
    setup([chat()])
    expect(screen.getByText('Español')).toBeInTheDocument()
  })

  it('invites you to start talking when there is nothing yet', () => {
    setup([])
    expect(screen.getByText(/No conversations yet/i)).toBeInTheDocument()
  })
})

describe('the list', () => {
  it('shows each conversation with its turn count', () => {
    setup([
      chat({ id: 'a', title: 'Ordering coffee', turn_count: 4 }),
      chat({ id: 'b', title: 'Weekend plans', turn_count: 11 }),
    ])
    expect(screen.getByText('Ordering coffee')).toBeInTheDocument()
    expect(screen.getByText(/11 turns/)).toBeInTheDocument()
  })

  it('labels an untitled conversation rather than showing a blank row', () => {
    setup([chat({ title: '' })])
    expect(screen.getByText('Empty conversation')).toBeInTheDocument()
  })

  it('describes when it was last touched, not a timestamp', () => {
    // What you remember about a conversation is roughly when, not to the second.
    // Titles deliberately unlike the time text, so the assertions can only
    // match the meta line.
    setup([
      chat({ id: 'a', title: 'Coffee', updated_at: NOW - 10 }),
      chat({ id: 'b', title: 'Markets', updated_at: NOW - 3 * 3600 }),
      chat({ id: 'c', title: 'Weather', updated_at: NOW - 30 * 3600 }),
      chat({ id: 'd', title: 'Untouched', updated_at: 0 }),
    ])
    expect(screen.getByText(/just now/i)).toBeInTheDocument()
    expect(screen.getByText(/3 hours ago/)).toBeInTheDocument()
    expect(screen.getByText(/yesterday/i)).toBeInTheDocument()
    expect(screen.getByText(/never opened/i)).toBeInTheDocument()
  })

  it('marks the conversation you are looking at', () => {
    const { container } = render(
      <ChatHistory
        open
        chats={[chat({ id: 'a' }), chat({ id: 'b' })]}
        currentId="b"
        languageName="Español"
        onClose={vi.fn()}
        onOpenChat={vi.fn()}
        onNewChat={vi.fn()}
        onDeleteChat={vi.fn()}
      />
    )
    const current = container.querySelectorAll('li.current')
    expect(current).toHaveLength(1)
  })

  it('opens the one you click', async () => {
    const { onOpenChat, user } = setup([chat({ id: 'a', title: 'Ordering coffee' })])
    await user.click(screen.getByText('Ordering coffee'))
    expect(onOpenChat).toHaveBeenCalledWith('a')
  })

  it('starts a new one', async () => {
    const { onNewChat, user } = setup([chat()])
    await user.click(screen.getByRole('button', { name: /New chat/i }))
    expect(onNewChat).toHaveBeenCalled()
  })
})

describe('deleting', () => {
  it('asks before it deletes', async () => {
    // One click on something irreplaceable should not be enough.
    const { onDeleteChat, user } = setup([chat({ id: 'a', title: 'Ordering coffee' })])
    await user.click(screen.getByLabelText('Delete Ordering coffee'))
    expect(onDeleteChat).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDeleteChat).toHaveBeenCalledWith('a')
  })

  it('lets you back out', async () => {
    const { onDeleteChat, user } = setup([chat({ id: 'a', title: 'Ordering coffee' })])
    await user.click(screen.getByLabelText('Delete Ordering coffee'))
    await user.click(screen.getByRole('button', { name: 'Keep' }))
    expect(onDeleteChat).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })
})

describe('dismissing', () => {
  it('closes on Escape', async () => {
    const { onClose, user } = setup([chat()])
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  it('closes when you click away from it', async () => {
    const { onClose, user } = setup([chat()])
    await user.click(document.querySelector('.drawer-scrim') as Element)
    expect(onClose).toHaveBeenCalled()
  })
})
