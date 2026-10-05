import { useI18n } from '../../../components/localization/i18n'
import { UI_LOCALE_METADATA } from '../../../domain/localization'
import { languageLabel } from '../../../domain/language/language-label'
import { languages } from '../../../platform/ipc/tauri'
import { VarietyField } from './VarietyField'

type LanguageChoice = { interface_locale: string; native_language: string; native_variety: string }

/** The primary choice changes both languages; an explicit secondary choice can differ. */
export function AppLanguageFields({ value, onChange, showVariety = true }: {
  value: LanguageChoice; onChange: (choice: LanguageChoice) => void; showVariety?: boolean
}) {
  const tr = useI18n()
  const catalog = languages()
  const explanation = catalog.find(language => language.code === value.native_language)
  const choose = (language: string, link: boolean) => {
    const definition = catalog.find(item => item.code === language)
    if (!definition) throw new Error(`Unknown language ${language}`)
    onChange({ interface_locale: link ? language : value.interface_locale, native_language: language,
      native_variety: language === value.native_language ? value.native_variety : definition.defaultVariety })
  }
  return <>
    <div className="form-row"><label>{tr('App language')}<select value={value.interface_locale} onChange={event => choose(event.target.value, true)}>
      {Object.entries(UI_LOCALE_METADATA).map(([id, language]) => <option key={id} value={id}>{languageLabel(language, tr.locale)}</option>)}
    </select></label></div>
    <details>
      <summary>{tr('Explanation options')}{value.native_language !== value.interface_locale && explanation ? ` · ${languageLabel(explanation, tr.locale)}` : ''}</summary>
      <div className="form-row"><label>{tr('Explain in')}<select value={value.native_language} onChange={event => choose(event.target.value, false)}>
        {catalog.map(language => <option key={language.code} value={language.code}>{languageLabel(language, tr.locale)}</option>)}
      </select></label></div>
      {showVariety && <div className="form-row"><label>{tr('Explanation variety')}</label><VarietyField label={tr('Explanation variety')}
        presets={explanation?.varieties ?? []} value={value.native_variety} onChange={native_variety => onChange({ ...value, native_variety })} /></div>}
    </details>
  </>
}
