import { useI18n } from '../../ui/i18n'

interface DialectFieldProps {
  presets: { id: string; label: string }[]
  value: string
  onChange: (v: string) => void
}

/** Only the workspace's declared varieties can be saved. */
export function DialectField({ presets, value, onChange }: DialectFieldProps) {
  const tr = useI18n()
  return <div className="dialect-field">
    <select value={value} onChange={event => onChange(event.target.value)} aria-label={tr('Regional variety presets')}>
      {!value && <option value="" disabled>{tr('Default')}</option>}
      {presets.map(preset => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
    </select>
  </div>
}
