import type { Partner } from '../../contracts'

/** Selecting only filters the directory; creation and editing are explicit actions. */
export function ContactChooser({ contacts, selectedId, busy, onSelect, onEdit, onCreate }: {
  contacts: Partner[]; selectedId: string; busy: boolean
  onSelect: (id: string) => void; onEdit: (id: string) => void; onCreate: (id: string) => void
}) {
  return <div className="contact-chooser">
    <label>Contact<select className="field" value={selectedId} disabled={busy || !contacts.length} onChange={event => onSelect(event.target.value)}>
      {!contacts.length && <option value="">No contacts</option>}
      {contacts.map(contact => <option key={contact.id} value={contact.id}>{contact.details.name}</option>)}
    </select></label>
    <div className="contact-profile-actions"><button type="button" className="btn" disabled={busy || !selectedId} onClick={() => onEdit(selectedId)}>Edit profile</button><button type="button" className="btn" disabled={busy || !selectedId} onClick={() => onCreate(selectedId)}>{busy ? 'Creating…' : 'New conversation'}</button></div>
  </div>
}
