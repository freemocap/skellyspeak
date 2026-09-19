import { useState } from 'react'
import type { Preferences } from '../../../generated/contracts'
import { UI_LOCALE_METADATA } from '../../../domain/localization'
import { languageLabel } from '../../../domain/language/language-label'
import { languages } from '../../../platform/ipc/tauri'
import { useI18n } from '../../../components/localization/i18n'
import { I18nProvider } from '../../../components/localization/i18n'
import { VarietyField } from '../language/VarietyField'

export function LanguageSetup({ preferences, busy, onSave }: {
  preferences: Preferences; busy: boolean
  onSave: (language: string, variety: string, explanation: string, locale: string) => void
}) {
  const [language, setLanguage] = useState(preferences.onboardingLanguage ?? '')
  const [variety, setVariety] = useState(language ? preferences.targetVarieties[language] : '')
  const [explanation, setExplanation] = useState(preferences.explanationLanguage)
  const [locale, setLocale] = useState(preferences.interfaceLocale)
  return <I18nProvider locale={locale}><LanguageForm {...{ language, variety, explanation, locale, busy, setLanguage, setVariety, setExplanation, setLocale }} onSave={() => onSave(language, variety, explanation, locale)} /></I18nProvider>
}

function LanguageForm({ language, variety, explanation, locale, busy, setLanguage, setVariety, setExplanation, setLocale, onSave }: {
  language: string; variety: string; explanation: string; locale: string; busy: boolean
  setLanguage: (value: string) => void; setVariety: (value: string) => void
  setExplanation: (value: string) => void; setLocale: (value: string) => void; onSave: () => void
}) {
  const tr = useI18n()
  const catalog = languages()
  const selected = catalog.find(item => item.code === language)
  return <form dir={UI_LOCALE_METADATA[locale].direction} lang={UI_LOCALE_METADATA[locale].tag} onSubmit={event => { event.preventDefault(); onSave() }}>
    <h1>{tr('Choose your languages')}</h1>
    <fieldset disabled={busy} className="onboarding-fields">
      <div className="form-row"><label htmlFor="setup-language">{tr('I want to learn')}</label>
        <select id="setup-language" required value={language} onChange={event => {
          const next = catalog.find(item => item.code === event.target.value)!
          setLanguage(next.code); setVariety(next.defaultVariety)
        }}><option value="" disabled>{tr('Choose a language')}</option>{catalog.map(item => <option key={item.code} value={item.code} lang={item.languageTag}>{languageLabel(item, locale)}</option>)}</select>
      </div>
      {selected && <div className="form-row"><span>{tr('Variety')}</span><VarietyField presets={selected.varieties} value={variety} onChange={setVariety} /></div>}
      <div className="form-row"><label htmlFor="setup-explanation">{tr('Explanation language')}</label><select id="setup-explanation" value={explanation} onChange={event => setExplanation(event.target.value)}>{catalog.map(item => <option key={item.code} value={item.code} lang={item.languageTag}>{languageLabel(item, locale)}</option>)}</select></div>
      <p className="field-note">{tr('You can change these choices and add more languages later.')}</p>
      <details><summary>{tr('Interface language')}</summary><div className="form-row"><label htmlFor="setup-locale">{tr('Interface language')}</label><select id="setup-locale" value={locale} onChange={event => setLocale(event.target.value)}>{Object.entries(UI_LOCALE_METADATA).map(([id, item]) => <option key={id} value={id} lang={item.tag}>{item.endonym}</option>)}</select></div></details>
      <div className="onboarding-actions"><button className="btn primary" disabled={!selected || busy} type="submit">{tr('Continue')}</button></div>
    </fieldset>
  </form>
}
