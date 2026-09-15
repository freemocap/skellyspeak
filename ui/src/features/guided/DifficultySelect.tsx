import { messageKey } from '../../domain/language/i18n'
import { useI18n } from '../../components/i18n'
import type { Difficulty } from '../../generated/contracts'

const DIFFICULTIES = [
  { value: 'absolute_zero', label: messageKey('Absolute zero') },
  { value: 'beginner', label: messageKey('Beginner') },
  { value: 'intermediate', label: messageKey('Intermediate') },
  { value: 'advanced', label: messageKey('Advanced') },
  { value: 'fluent', label: messageKey('Fluent') },
] as const satisfies ReadonlyArray<{ value: Difficulty; label: string }>

/** An explicit selection saves settings; the caller owns persistence and errors. */
export function DifficultySelect({ value, saving, onChange }: {
  value: Difficulty; saving: boolean; onChange: (value: Difficulty) => Promise<void>
}) {
  const tr = useI18n()
  return <select className="chat-language-picker" aria-label={tr("Difficulty")} title={saving ? tr("Saving difficulty…") : tr("Conversation difficulty")} aria-busy={saving} value={value} disabled={saving}
    onChange={event => {
      const selected = DIFFICULTIES.find(item => item.value === event.target.value)
      if (selected && selected.value !== value) void onChange(selected.value).catch(() => { /* The owner presents save errors. */ })
    }}>
    {DIFFICULTIES.map(item => <option key={item.value} value={item.value}>{tr(item.label)}</option>)}
  </select>
}
