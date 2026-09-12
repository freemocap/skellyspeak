import type { Difficulty } from '../../contracts'

const DIFFICULTIES = [
  { value: 'absolute_zero', label: 'Absolute zero' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'fluent', label: 'Fluent' },
] as const satisfies ReadonlyArray<{ value: Difficulty; label: string }>

/** An explicit selection saves settings; the caller owns persistence and errors. */
export function DifficultySelect({ value, saving, onChange }: {
  value: Difficulty; saving: boolean; onChange: (value: Difficulty) => Promise<void>
}) {
  return <select className="chat-language-picker" aria-label="Difficulty" title={saving ? 'Saving difficulty…' : 'Conversation difficulty'} aria-busy={saving} value={value} disabled={saving}
    onChange={event => {
      const selected = DIFFICULTIES.find(item => item.value === event.target.value)
      if (selected && selected.value !== value) void onChange(selected.value).catch(() => { /* The owner presents save errors. */ })
    }}>
    {DIFFICULTIES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
  </select>
}
