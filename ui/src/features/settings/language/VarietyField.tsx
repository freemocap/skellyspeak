import { useI18n } from '../../../components/localization/i18n'

interface VarietyFieldProps {
  presets: { id: string; label: string }[]
  label?: string
  value: string
  onChange: (v: string) => void
}

/** Only the workspace's declared varieties can be saved. */
export function VarietyField({ presets, value, onChange, label }: VarietyFieldProps) {
  const tr = useI18n()
  if (!presets.some(preset => preset.id === value)) throw new Error('The selected variety is unavailable.')
  if (presets.length === 1) return <span>{tr(presets[0].label)}</span>
  return <div className="variety-field">
    <select value={value} onChange={event => onChange(event.target.value)} aria-label={label ?? tr('Variety')}>
      {presets.map(preset => <option key={preset.id} value={preset.id}>{tr(preset.label)}</option>)}
    </select>
  </div>
}
