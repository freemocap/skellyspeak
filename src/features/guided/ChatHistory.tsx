import { t, formatDate, formatRelativeTime } from '../../domain/language/i18n'
import { useI18n } from '../../ui/i18n'
import { useEffect, useState } from 'react'
import type { ChatSummary } from '../../types'

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
function whenever(updatedAt: number, locale: string): string {
  if (!updatedAt) return t(locale, 'Never opened')
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - updatedAt)
  if (seconds < 60) return formatRelativeTime(locale, 0, 'second')
  if (seconds < 3600) return formatRelativeTime(locale, -Math.floor(seconds / 60), 'minute')
  if (seconds < 86400) return formatRelativeTime(locale, -Math.floor(seconds / 3600), 'hour')
  if (seconds < 30 * 86400) return formatRelativeTime(locale, -Math.floor(seconds / 86400), 'day')
  return formatDate(locale, updatedAt * 1000)
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
  const tr = useI18n()
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
      <aside className="chat-history" aria-label={tr("All conversations")}>
        <div className="chat-history-head">
          <span className="chat-history-lang">{languageName}</span>
          <button type="button" className="chat-history-new" onClick={onNewChat}>
            {tr("✚ New chat")}</button>
        </div>

        {chats.length === 0 ? (
          <p className="chat-history-empty">
            {tr("No conversations yet. Choose New conversation to begin.")}</p>
        ) : (
          <ul className="chat-history-list">
            {chats.map((chat) => (
              <li key={chat.id} className={chat.id === currentId ? 'current' : undefined}>
                <button
                  type="button"
                  className="chat-history-item"
                  onClick={() => onOpenChat(chat.id)}
                  title={chat.title || tr("Empty conversation")}
                >
                  <span className="chat-history-title">
                    {chat.title || <em>{tr("Empty conversation")}</em>}
                  </span>
                  <span className="chat-history-meta">{languageName}</span>
                  <span className="chat-history-meta">
                    {whenever(chat.updated_at, tr.locale)}
                    {chat.turn_count !== undefined && chat.turn_count > 0 && tr("Conversation turns", { count: chat.turn_count })}
                  </span>
                </button>
                {confirming === chat.id ? (
                  <span className="chat-history-confirm">
                    <button
                      type="button"
                      title={tr("Delete this conversation")}
                      onClick={() => {
                        setConfirming(null)
                        onDeleteChat(chat.id)
                      }}
                    >
                      {tr("Delete")}</button>
                    <button type="button" onClick={() => setConfirming(null)}>
                      {tr("Keep")}</button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="chat-history-delete"
                    title={tr("Delete this conversation")}
                    aria-label={tr("Delete {value0}", { value0: String(chat.title || 'this conversation') })}
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
