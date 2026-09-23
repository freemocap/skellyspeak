import { messageKey } from '../../domain/localization'
import { useI18n } from '../localization/i18n'
import { DIFFICULTY_LEVELS, type Difficulty } from '../../generated/contracts'

/// Interface labels for the native difficulty levels. The levels and their
/// order come from the generated contract; only their display names live here.
const LABELS = {
  absolute_zero: messageKey('Absolute zero'),
  beginner: messageKey('Beginner'),
  intermediate: messageKey('Intermediate'),
  advanced: messageKey('Advanced'),
  fluent: messageKey('Fluent'),
} as const satisfies Record<Difficulty, string>

export function difficultyLabel(value: Difficulty): string {
  return LABELS[value]
}

/** An explicit selection saves settings; the caller owns persistence and errors. */
export function DifficultySelect({ value, saving, onChange }: {
  value: Difficulty; saving: boolean; onChange: (value: Difficulty) => Promise<void>
}) {
  const tr = useI18n()
  return <select className="chat-language-picker" aria-label={tr("Difficulty")} title={saving ? tr("Saving difficulty…") : tr("Conversation difficulty")} aria-busy={saving} value={value} disabled={saving}
    onChange={event => {
      const selected = DIFFICULTY_LEVELS.find(level => level === event.target.value)
      if (selected === undefined) throw new Error(`Unknown difficulty level: ${event.target.value}`)
      if (selected !== value) void onChange(selected).catch(() => { /* The owner presents save errors. */ })
    }}>
    {DIFFICULTY_LEVELS.map(level => <option key={level} value={level}>{tr(LABELS[level])}</option>)}
  </select>
}
