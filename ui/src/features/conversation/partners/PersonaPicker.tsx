import { InspectText } from '../../../components/reading/InspectText'
import { useI18n } from '../../../components/localization/i18n'
import { useEffect, useRef, useState } from 'react'
import { PersonaAvatar } from '../../../components/media/PersonaAvatar'

/// One contact as the picker shows it: the persona's display name and its first
/// vibe emoji, when it has one.
export interface PersonaChoice { id: string; name: string; symbol: string | undefined }

/// The chat header's persona control: the contact being spoken with, every other
/// contact for this language, and the one action that adds another.
export function PersonaPicker({ choices, currentId, busy, onSelect, onEdit, onCreate }: {
  choices: PersonaChoice[]
  currentId: string
  busy: boolean
  onSelect: (contactId: string) => void
  onEdit: () => void
  onCreate: () => void
}) {
  const tr = useI18n()
  const [open, setOpen] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('[role="dialog"]')) return
      if (!panel.current?.contains(target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape) }
  }, [open])
  const current = choices.find(choice => choice.id === currentId)
  return <div className="persona-picker" ref={panel}>
    <button type="button" className="persona-picker-toggle" aria-haspopup="menu" aria-expanded={open} disabled={busy}
      title={current ? tr("Talking with {value0}", { value0: String(current.name) }) : tr("No contact for this language yet")} onClick={() => setOpen(value => !value)}>
      {current ? <><PersonaAvatar symbol={current.symbol} /><span className="partner-identity"><strong>{current.name}</strong></span></> : <span>{tr("No persona")}</span>}
      <span aria-hidden="true">▾</span>
    </button>
    {current && <InspectText text={current.name} />}
    {open && <div className="persona-picker-menu" role="menu" aria-label={tr("Contacts")}>
      {choices.map(choice => <button type="button" role="menuitemradio" aria-checked={choice.id === currentId} key={choice.id}
        className="persona-picker-item" onClick={() => { setOpen(false); if (choice.id !== currentId) onSelect(choice.id) }}>
        <PersonaAvatar symbol={choice.symbol} /><span>{choice.name}</span>{choice.id === currentId && <span aria-hidden="true">✓</span>}
      </button>)}
      <button type="button" role="menuitem" className="persona-picker-item" disabled={!current} onClick={() => { setOpen(false); onEdit() }}>{tr("Edit persona")}</button>
      <button type="button" role="menuitem" className="persona-picker-item" onClick={() => { setOpen(false); onCreate() }}>{tr("+ New persona…")}</button>
    </div>}
  </div>
}
