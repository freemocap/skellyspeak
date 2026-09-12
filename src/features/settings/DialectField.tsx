import { useState } from 'react'

interface DialectFieldProps {
  presets: { id: string; label: string }[]
  value: string
  onChange: (v: string) => void
}

/// Dialect picker: preset dropdown + free-text input kept in sync. Choosing
/// a preset fills the input; typing a custom value overrides it. The stored
/// value is always the raw string passed to the AI prompts.
export function DialectField({ presets, value, onChange }: DialectFieldProps) {
  const isPreset = presets.some((d) => d.id === value)
  const [mode, setMode] = useState<'preset' | 'custom'>(value && !isPreset ? 'custom' : 'preset')

  return (
    <div className="dialect-field">
      <select
        value={mode === 'preset' ? value : ''}
        onChange={(e) => {
          setMode('preset')
          onChange(e.target.value)
        }}
        aria-label="Regional variety presets"
      >
        <option value="">Default</option>
        {presets.map((d) => (
          <option key={d.id} value={d.id}>
            {d.label}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={mode === 'custom' ? value : ''}
        placeholder="…or type a custom variety"
        onFocus={() => setMode('custom')}
        onChange={(e) => {
          setMode('custom')
          onChange(e.target.value)
        }}
        aria-label="Custom regional variety"
      />
    </div>
  )
}
