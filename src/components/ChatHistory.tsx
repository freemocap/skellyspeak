import { useEffect, useState } from 'react'
import type { ChatSummary } from '../types'

interface ChatHistoryProps {
  open: boolean
  chats: ChatSummary[]
  currentId: string | null
  /// The language being learned, so it is obvious which set of chats this is.
  languageName: string
  onClose: () => void
  onOpenChat: (id: string) => void
  onNewChat: () => void
  onDeleteChat: (id: string) => void
}

/// "3 minutes ago", "yesterday". Absolute timestamps are precise and useless
/// for picking a conversation out of a list; what you remember is roughly when.
function whenever(updatedAt: number): string {
  if (!updatedAt) return 'never opened'
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - updatedAt)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  return new Date(updatedAt * 1000).toLocaleDateString()
}

/// The chat history drawer.
///
/// Only ever lists chats for the pairing you are in: a Spanish conversation and
/// an Arabic one are separate practice, and mixing them in one list would make
/// the common case — "the Spanish chat from yesterday" — harder, not easier.
export function ChatHistory({
  open,
  chats,
  currentId,
  languageName,
  onClose,
  onOpenChat,
  onNewChat,
  onDeleteChat,
}: ChatHistoryProps) {
  // Deleting is one click on something irreplaceable, so it asks first. The
  // files survive a delete regardless, but the user cannot see that.
  const [confirming, setConfirming] = useState<string | null>(null)

  useEffect(() => {
    if (!open) setConfirming(null)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} aria-hidden="true" />
      <aside className="chat-history" aria-label="Chat history">
        <div className="chat-history-head">
          <span className="chat-history-lang">{languageName}</span>
          <button type="button" className="chat-history-new" onClick={onNewChat}>
            ✚ New chat
          </button>
        </div>

        {chats.length === 0 ? (
          <p className="chat-history-empty">
            No conversations yet. Start talking and this one will be saved here.
          </p>
        ) : (
          <ul className="chat-history-list">
            {chats.map((chat) => (
              <li key={chat.id} className={chat.id === currentId ? 'current' : undefined}>
                <button
                  type="button"
                  className="chat-history-item"
                  onClick={() => onOpenChat(chat.id)}
                  title={chat.title || 'Empty conversation'}
                >
                  <span className="chat-history-title">
                    {chat.title || <em>Empty conversation</em>}
                  </span>
                  <span className="chat-history-meta">
                    {whenever(chat.updated_at)}
                    {chat.turn_count > 0 && ` · ${chat.turn_count} turns`}
                  </span>
                </button>
                {confirming === chat.id ? (
                  <span className="chat-history-confirm">
                    <button
                      type="button"
                      title="Delete this conversation"
                      onClick={() => {
                        setConfirming(null)
                        onDeleteChat(chat.id)
                      }}
                    >
                      Delete
                    </button>
                    <button type="button" onClick={() => setConfirming(null)}>
                      Keep
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="chat-history-delete"
                    title="Delete this conversation"
                    aria-label={`Delete ${chat.title || 'this conversation'}`}
                    onClick={() => setConfirming(chat.id)}
                  >
                    🗑
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </aside>
    </>
  )
}
