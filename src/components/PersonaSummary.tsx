import { useEffect, useState } from 'react'
import { nativeError, readWorkspace } from '../lib/workspace'

export function PersonaSummary({ chatId }: { chatId: string | null }) {
  const [saved, setSaved] = useState<{ chatId: string; name: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    setError(null)
    if (chatId) void readWorkspace().then(snapshot => {
      const conversation = snapshot.conversations.find(c => c.id === chatId)
      const relationship = snapshot.relationships.find(r => r.id === conversation?.relationshipId)
      const partner = snapshot.partners.find(p => p.id === relationship?.partnerId)
      if (!partner) throw new Error('Conversation partner is unavailable.')
      if (active) setSaved({ chatId, name: partner.details.name })
    }).catch(reason => { if (active) setError(nativeError(reason)) })
    return () => { active = false }
  }, [chatId])
  if (error) return <span role="alert">{error}</span>
  if (saved?.chatId !== chatId || !saved) return null
  return <span> · Persona: {saved.name}</span>
}
