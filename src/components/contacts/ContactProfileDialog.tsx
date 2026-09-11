import { useRef } from 'react'
import type { Partner, PartnerDetails } from '../../contracts'
import { DetailDialog } from '../DetailDialog'
import { ContactProfile, type ContactProfileHandle } from './ContactProfile'

export function ContactProfileDialog({ contact, language, onSave, onClose }: {
  contact: Partner; language: string
  onSave: (contact: Partner, details: PartnerDetails) => Promise<Partner>
  onClose: () => void
}) {
  const editor = useRef<ContactProfileHandle>(null)
  const closing = useRef(false)
  const close = async () => {
    if (closing.current || !editor.current) return
    closing.current = true
    try { await editor.current.flush(); onClose() }
    catch { /* Validation/save failure stays visible with its draft. */ }
    finally { closing.current = false }
  }
  return <DetailDialog title="Contact profile" onClose={() => { void close() }}>
    <h2>Contact profile</h2>
    <ContactProfile ref={editor} contact={contact} language={language} onSave={onSave} />
  </DetailDialog>
}
