import { useI18n } from '../../components/i18n'
import { languages } from '../../platform/ipc/tauri'
import { languageLabel } from '../../domain/language/language-label'
import { useNavigationStore } from '../../state/navigation'
import { useSettingsStore, type LanguageField } from '../../state/settings'

/// The two language pickers own their own wiring: they read the record, the
/// saving flag and whether the settings modal is over them, and write through the
/// store. The shell renders them and nothing else.

function usePicker() {
  const settings = useSettingsStore((state) => state.settings)
  const saving = useSettingsStore((state) => state.savingLanguage)
  const settingsOverlay = useNavigationStore((state) => state.overlay === 'settings')
  const change = (field: LanguageField, value: string) => {
    if (!settings || saving || settingsOverlay || settings[field] === value) return
    void useSettingsStore.getState().setLanguage(field, value)
  }
  return { settings, saving, disabled: saving || settingsOverlay, change }
}

/// The target-language picker shown large in the conversation header.
export function LearningPicker() {
  const tr = useI18n()
  const { settings, saving, disabled, change } = usePicker()
  if (!settings) return null
  return <>
    <select className="learning-picker" aria-label={tr("Target language")}
      value={settings.target_language} disabled={disabled}
      onChange={event => change('target_language', event.target.value)}>
      {languages().map(language => <option lang={language.code} key={language.code} value={language.code}>{languageLabel(language, tr.locale)}</option>)}
    </select>
    {saving && <span role="status" className="learning-saving">{tr("Saving…")}</span>}
  </>
}

/// The explanation-language picker, kept in the conversation settings panel.
/// Options are de-duplicated by base language: the registry holds one entry per
/// variety, and the learner picks a language here, not a variety.
export function NativePicker() {
  const tr = useI18n()
  const { settings, disabled, change } = usePicker()
  if (!settings) return null
  return (
    <label><span>{tr("Native")}</span><select className="chat-language-picker" aria-label={tr("Native language")} value={settings.native_language}
      disabled={disabled} onChange={event => change('native_language', event.target.value)}>
      {languages().filter((language, index, all) => all.findIndex(item => item.base === language.base) === index).map(language => <option lang={language.code} key={language.base} value={language.base}>{languageLabel(language, tr.locale)}</option>)}
    </select></label>
  )
}
