import { InspectText } from '../../../components/reading/InspectText'
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

/// Choosing a language is the first thing anyone does here, so it is a choice
/// between languages rather than a row in a form: each one says its own name in
/// its own script, greets you in it, and names the person you will be talking to.
/// All three are bundled content, so this renders before any AI exists.
function LanguageForm({ language, variety, explanation, locale, busy, setLanguage, setVariety, setExplanation, setLocale, onSave }: {
  language: string; variety: string; explanation: string; locale: string; busy: boolean
  setLanguage: (value: string) => void; setVariety: (value: string) => void
  setExplanation: (value: string) => void; setLocale: (value: string) => void; onSave: () => void
}) {
  const tr = useI18n()
  const catalog = languages()
  const selected = catalog.find(item => item.code === language)
  return <form dir={UI_LOCALE_METADATA[locale].direction} lang={UI_LOCALE_METADATA[locale].tag} onSubmit={event => { event.preventDefault(); onSave() }}>
    <h1>{tr('I want to learn')}</h1>
    <fieldset disabled={busy} className="onboarding-fields">
      <div className="language-choices" role="radiogroup" aria-label={tr('I want to learn')}>
        {catalog.map(item => <button type="button" key={item.code} className="language-choice"
          role="radio" aria-checked={item.code === language}
          onClick={() => { setLanguage(item.code); setVariety(item.defaultVariety) }}>
          {/* Each language names itself in its own script, at its own scale and
              direction, rather than in the interface's. */}
          <span className="language-choice-endonym" lang={item.languageTag} dir={item.direction}
            style={{ ['--script-scale' as string]: item.fontScale }}>{item.endonym}</span>
          <span className="language-choice-greeting" lang={item.languageTag} dir={item.direction}>{item.greeting.text}</span>
          <span className="language-choice-name">{languageLabel(item, locale)}</span>
        </button>)}
      </div>

      {selected && <div className="language-chosen"><InspectText text={selected.greeting.text} language={selected.code} variety={variety} />
        <p className="language-chosen-partner">
          <span className="language-chosen-vibe" aria-hidden="true">{selected.partner.vibe[0] ?? ''}</span>
          {tr('You will be talking with {name}', { name: selected.partner.romanizedName ?? selected.partner.name })}
        </p>
        {selected.varieties.length > 1 && <div className="form-row"><span>{tr('Variety')}</span><VarietyField presets={selected.varieties} value={variety} onChange={setVariety} /></div>}
      </div>}

      <div className="onboarding-secondary">
        <div className="form-row"><label htmlFor="setup-explanation">{tr('Explanation language')}</label><select id="setup-explanation" value={explanation} onChange={event => setExplanation(event.target.value)}>{catalog.map(item => <option key={item.code} value={item.code} lang={item.languageTag}>{languageLabel(item, locale)}</option>)}</select></div>
        <div className="form-row"><label htmlFor="setup-locale">{tr('Interface language')}</label><select id="setup-locale" value={locale} onChange={event => setLocale(event.target.value)}>{Object.entries(UI_LOCALE_METADATA).map(([id, item]) => <option key={id} value={id} lang={item.tag}>{item.endonym}</option>)}</select></div>
        <p className="field-note">{tr('You can change these choices and add more languages later.')}</p>
      </div>

      <div className="onboarding-actions"><button className="btn primary" disabled={!selected || busy} type="submit">{tr('Continue')}</button></div>
    </fieldset>
  </form>
}
