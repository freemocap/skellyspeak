import { languages } from '../../platform/ipc/tauri'
import type { Settings } from '../../types'

interface PickerProps {
  settings: Settings
  /// A language save is in flight; the "Saving…" note belongs beside the target.
  saving: boolean
  /// Another surface owns the interaction right now (the Settings modal).
  disabled: boolean
  onChange: (field: 'target_language' | 'native_language', value: string) => void
}

/// The target-language picker shown large in the conversation header.
export function LearningPicker({ settings, saving, disabled, onChange }: PickerProps) {
  const scale = languages().find(language => language.code === settings.target_language)?.fontScale ?? 1
  return <>
    <select className="learning-picker" style={{ fontSize: `${15 * Math.min(1.15, scale)}px` }} aria-label="Target language"
      value={settings.target_language} disabled={saving || disabled}
      onChange={event => onChange('target_language', event.target.value)}>
      {languages().map(language => <option lang={language.code} key={language.code} value={language.code}>{language.endonym}</option>)}
    </select>
    {saving && <span role="status" className="learning-saving">Saving…</span>}
  </>
}

/// The explanation-language picker, kept in the conversation settings panel.
/// Options are de-duplicated by base language: the registry holds one entry per
/// variety, and the learner picks a language here, not a variety.
export function NativePicker({ settings, saving, disabled, onChange }: PickerProps) {
  const scale = languages().find(language => language.base === settings.native_language)?.fontScale ?? 1
  return (
    <label><span>Native</span><select className="chat-language-picker" style={{ fontSize: `${13 * Math.min(1.15, scale)}px` }} aria-label="Native language" value={settings.native_language}
      disabled={saving || disabled} onChange={event => onChange('native_language', event.target.value)}>
      {languages().filter((language, index, all) => all.findIndex(item => item.base === language.base) === index).map(language => <option lang={language.code} style={{ fontSize: `${13 * Math.min(language.fontScale, 1.15)}px` }} key={language.base} value={language.base}>{language.endonym}</option>)}
    </select></label>
  )
}
