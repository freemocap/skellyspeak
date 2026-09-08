import { useEffect, useState } from 'react'
import { invoke, isTauri, type ConversationPartner } from '../lib/tauri'
import { personaLabel } from '../lib/personaLabel'
import { reportFault } from '../lib/faults'

export function PersonaSummary({ chatId }: { chatId: string | null }) {
  const [saved, setSaved] = useState<{ chatId: string; partner: ConversationPartner } | null>(null)
  useEffect(() => {
    if (!isTauri || !chatId) return
    let active = true
    void invoke<ConversationPartner>('get_conversation_partner', { chatId }).then(partner => {
      if (active) setSaved({ chatId, partner })
    }).catch((error: unknown) => reportFault('Loading persona summary', error))
    return () => { active = false }
  }, [chatId])
  const partner = saved?.chatId === chatId ? saved?.partner : null
  if (!partner || partner.persona.id === '__none__') return null
  return <span> · Persona: {personaLabel(partner.persona)}</span>
}
