import { useCallback, useEffect, useRef, useState } from 'react'
import type { Difficulty, Partner, PartnerDetails, Snapshot } from '../../contracts'
import { executeAction, nativeError, readWorkspace } from '../../lib/workspace'

/** Directory reads and explicit edits; no inference or automatic retries. */
export function useConversationDetails(chatId: string | null, revision: number) {
  const [directory, setDirectory] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const readGeneration = useRef(0)
  const scope = useRef(chatId)
  scope.current = chatId
  const contactPending = useRef<Promise<Partner> | null>(null)
  const pending = useRef<Promise<void> | null>(null)
  const refresh = useCallback(async () => {
    const generation = ++readGeneration.current
    const next = await readWorkspace()
    if (generation === readGeneration.current) { setDirectory(next); setError(null) }
    return next
  }, [])
  useEffect(() => {
    if (!chatId) { setDirectory(null); return }
    let active = true
    void refresh().catch(reason => { if (active) setError(nativeError(reason)) })
    return () => { active = false; readGeneration.current++ }
  }, [chatId, revision, refresh])
  const conversation = directory?.conversations.find(item => item.id === chatId)
  const relationship = directory?.relationships.find(item => item.id === conversation?.relationshipId)
  const contact = directory?.partners.find(item => item.id === relationship?.partnerId)

  const saveDifficulty = (difficulty: Difficulty): Promise<void> => {
    if (!conversation || !directory) return Promise.reject(new Error('Conversation settings are unavailable.'))
    if (pending.current) return Promise.reject(new Error('Wait for the current settings save.'))
    const owner = conversation
    setSaving(true); setError(null)
    const write = (async () => {
      try {
        const latest = await readWorkspace()
        if (scope.current !== owner.id) throw new Error('The selected conversation changed before saving.')
        const current = latest.conversations.find(item => item.id === owner.id)
        if (!current || current.settingsRevision !== owner.settingsRevision) throw new Error('Conversation settings changed. Reload before saving.')
        await executeAction(latest, { kind: 'updateSettings', conversationId: owner.id, expectedRevision: owner.settingsRevision, settings: { ...current.settings, difficulty } })
        await refresh()
      } catch (reason) { setError(nativeError(reason)); throw reason }
      finally { pending.current = null; setSaving(false) }
    })()
    pending.current = write
    return write
  }
  const saveContact = (owner: Partner, details: PartnerDetails): Promise<Partner> => {
    if (contactPending.current) return Promise.reject(new Error('Wait for the current profile save.'))
    const write = (async () => {
      try {
        const latest = await readWorkspace()
        await executeAction(latest, { kind: 'updatePartner', partnerId: owner.id, expectedRevision: owner.revision, details })
        const next = await refresh()
        const saved = next.partners.find(item => item.id === owner.id)
        if (!saved) throw new Error('Saved contact is unavailable.')
        return saved
      } finally { contactPending.current = null }
    })()
    contactPending.current = write
    return write
  }
  const createConversation = async (partnerId: string) => {
    const latest = await readWorkspace()
    const owner = latest.relationships.find(item => item.partnerId === partnerId && !item.archived)
    if (!owner) throw new Error('This contact is unavailable.')
    const receipt = await executeAction(latest, { kind: 'createConversation', relationshipId: owner.id, title: 'Conversation' })
    return receipt.entityId
  }
  return { directory, conversation, contact, error, saving, saveDifficulty, saveContact, createConversation,
    beforeSend: async () => { if (pending.current) await pending.current; if (contactPending.current) await contactPending.current },
  }
}
