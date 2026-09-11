import { useEffect, useState } from 'react'
import type { Partner, Snapshot } from '../contracts'
import { executeAction, nativeError, readWorkspace } from '../lib/workspace'

interface PersonaFieldProps {
  chatId: string | null
  /** Select the real conversation created for the chosen partner. */
  onChange: (conversationId: string) => void
}

export function PersonaField({ chatId, onChange }: PersonaFieldProps) {
  const [workspace, setWorkspace] = useState<Snapshot | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    let active = true
    setWorkspace(null)
    setOpen(false)
    setError(null)
    if (chatId) void readWorkspace().then(value => {
      if (active) setWorkspace(value)
    }).catch(reason => { if (active) setError(nativeError(reason)) })
    return () => { active = false }
  }, [chatId])
  const conversation = workspace?.conversations.find(c => c.id === chatId)
  const relationship = workspace?.relationships.find(r => r.id === conversation?.relationshipId)
  const partner = workspace?.partners.find(p => p.id === relationship?.partnerId)
  const available = workspace?.partners.filter(p => p.languageId === conversation?.languageId &&
    workspace.relationships.some(r => r.partnerId === p.id && !r.archived)) ?? []

  async function start(partnerId?: string) {
    if (!workspace || !conversation || busy) return
    setBusy(true)
    setError(null)
    try {
      if (!partnerId) {
        const receipt = await executeAction(workspace, { kind: 'startChat', languageId: conversation.languageId })
        onChange(receipt.entityId)
        return
      }
      const target = workspace.relationships.find(r => r.partnerId === partnerId && !r.archived)
      if (!target) throw new Error('Partner relationship is unavailable.')
      const receipt = await executeAction(workspace, { kind: 'createConversation', relationshipId: target.id, title: 'New conversation' })
      onChange(receipt.entityId)
    } catch (reason) { setError(nativeError(reason)) }
    finally { setBusy(false) }
  }

  return <section className="persona-config" aria-label="Persona settings">
    <div className="steer-row persona-row">
      <label className="persona-toggle" htmlFor="persona-select">Persona</label>
      <select id="persona-select" aria-label="Partner" className="steer-select persona"
        disabled={busy || !partner} value={partner?.id ?? ''} onChange={event => { void start(event.target.value) }}
        title="Choose a partner and start a new conversation">
        {!partner && <option value="">{chatId ? 'Loading partner…' : 'No conversation selected'}</option>}
        {available.map(p => <option key={p.id} value={p.id}>{p.details.name}{p.id === partner?.id ? ' (current conversation)' : ''}</option>)}
      </select>
      <button type="button" className="steer-dice" disabled={busy || !partner} aria-label="New partner" title="Create a partner and start a new conversation" onClick={() => { void start() }}>🎲</button>
      <button type="button" className="steer-dice persona-open" disabled={busy || !partner} aria-label="Partner details" onClick={() => setOpen(!open)}>ⓘ</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {open && partner && <PartnerDetails partner={partner} />}
  </section>
}

function PartnerDetails({ partner }: { partner: Partner }) {
  return <div className="persona-summary">
    <strong>{partner.details.name}</strong>
    {partner.details.background && <p>{partner.details.background}</p>}
    {partner.details.tendencies && <p>{partner.details.tendencies}</p>}
    {partner.details.vibe.length > 0 && <p>{partner.details.vibe.join(' ')}</p>}
  </div>
}
