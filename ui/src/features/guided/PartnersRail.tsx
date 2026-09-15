import { useI18n } from '../../components/i18n'
import { PersonaAvatar } from '../../components/PersonaAvatar'
import type { PersonaChoice } from './PersonaPicker'

export function PartnersRail({ choices, currentId, languageName, busy, onSelect, onCreate, onHistory }: {
  choices: PersonaChoice[]; currentId: string; languageName: string; busy: boolean
  onSelect: (id: string) => void; onCreate: () => void; onHistory: () => void
}) {
  const tr = useI18n()
  return <aside className="partners-rail" aria-label={tr('Partners')}>
    <div className="pane-header"><span>{tr('Partners')}</span><button type="button" disabled={busy} aria-label={tr('+ New persona…')} onClick={onCreate}>+</button></div>
    <div className="partners-list">{choices.map(choice => <button type="button" key={choice.id} disabled={busy} aria-pressed={choice.id === currentId} className="partner-row" onClick={() => onSelect(choice.id)}>
      <PersonaAvatar symbol={choice.symbol} /><span><strong>{choice.name}</strong><small>{languageName}</small></span>
    </button>)}</div>
    <button type="button" onClick={onHistory}>{tr('All conversations')}</button>
  </aside>
}
