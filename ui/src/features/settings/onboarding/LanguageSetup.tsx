import { InspectText } from '../../../components/reading/InspectText'
import { useState } from 'react'
import type { Preferences } from '../../../generated/contracts'
import { UI_LOCALE_METADATA } from '../../../domain/localization'
import { languageLabel } from '../../../domain/language/language-label'
import { languages } from '../../../platform/ipc/tauri'
import { useI18n } from '../../../components/localization/i18n'
import { I18nProvider } from '../../../components/localization/i18n'
import { ToolbarIcon } from '../../../components/controls/ToolbarIcon'
import { VarietyField } from '../language/VarietyField'

type Choice = { chosen: string[]; start: string; varieties: Record<string, string> }

export function LanguageSetup({ preferences, busy, onSave }: {
  preferences: Preferences; busy: boolean
  onSave: (chosen: string[], start: string, varieties: Record<string, string>, explanation: string, locale: string) => void
}) {
  const start = preferences.onboardingLanguage ?? ''
  const [choice, setChoice] = useState<Choice>({
    chosen: [...new Set([...preferences.myLanguages, ...(start ? [start] : [])])],
    start,
    varieties: preferences.targetVarieties,
  })
  const [explanation, setExplanation] = useState(preferences.explanationLanguage)
  const [locale, setLocale] = useState(preferences.interfaceLocale)
  return <I18nProvider locale={locale}><LanguageForm {...{ choice, setChoice, explanation, locale, busy, setExplanation, setLocale }}
    onSave={() => onSave(choice.chosen, choice.start, choice.varieties, explanation, locale)} /></I18nProvider>
}

/// Choosing languages is the first thing anyone does here, so each language is a
/// card that says its own name in its own script and greets you in it. Every
/// card's corner checkbox adds or removes it; pressing the card makes it the
/// starting language, which the Start in field above also sets. All of this is
/// bundled content, so it renders before any AI exists.
function LanguageForm({ choice, setChoice, explanation, locale, busy, setExplanation, setLocale, onSave }: {
  choice: Choice; setChoice: (update: (previous: Choice) => Choice) => void
  explanation: string; locale: string; busy: boolean
  setExplanation: (value: string) => void; setLocale: (value: string) => void; onSave: () => void
}) {
  const tr = useI18n()
  const catalog = languages()
  const selected = catalog.find(item => item.code === choice.start)
  const chosen = catalog.filter(item => choice.chosen.includes(item.code))
  const variety = selected ? choice.varieties[selected.code] ?? selected.defaultVariety : ''
  const withVariety = (previous: Choice, code: string) => {
    const item = catalog.find(entry => entry.code === code)
    if (!item) throw new Error(`Unknown language ${code}`)
    return previous.varieties[code] ? previous.varieties : { ...previous.varieties, [code]: item.defaultVariety }
  }
  const makeStart = (code: string) => setChoice(previous => ({
    chosen: previous.chosen.includes(code) ? previous.chosen : [...previous.chosen, code], start: code, varieties: withVariety(previous, code),
  }))
  const toggle = (code: string) => setChoice(previous => {
    if (!previous.chosen.includes(code)) return { chosen: [...previous.chosen, code], start: previous.start || code, varieties: withVariety(previous, code) }
    const remaining = previous.chosen.filter(item => item !== code)
    return { ...previous, chosen: remaining, start: previous.start === code ? remaining[0] ?? '' : previous.start }
  })
  return <form className="onboarding-languages" dir={UI_LOCALE_METADATA[locale].direction} lang={UI_LOCALE_METADATA[locale].tag} onSubmit={event => { event.preventDefault(); onSave() }}>
    <fieldset disabled={busy} className="onboarding-fields">
      <div className="onboarding-languages-head">
        <h1 className="onboarding-languages-title">{tr('Languages')}</h1>
        <div className="onboarding-languages-actions">
          <label className="onboarding-start-field"><span>{tr('Start in')}</span>
            <select value={choice.start} disabled={!chosen.length} onChange={event => makeStart(event.target.value)}>
              {!chosen.length && <option value="">{tr('Choose a language')}</option>}
              {chosen.map(item => <option key={item.code} value={item.code} lang={item.languageTag}>{languageLabel(item, locale)}</option>)}
            </select>
          </label>
          <button className="btn primary" disabled={!selected || busy} type="submit">{tr('Continue')}</button>
        </div>
      </div>

      <div className="language-choices" role="group" aria-label={tr('Languages')}>
        {catalog.map(item => {
          const isChosen = choice.chosen.includes(item.code)
          const isStart = choice.start === item.code
          return <div key={item.code} className="language-choice" data-chosen={isChosen} data-start={isStart}>
            <button type="button" className="language-choice-start" aria-pressed={isStart} onClick={() => makeStart(item.code)}>
              {isStart && <span className="language-choice-badge">{tr('Start')}</span>}
              {/* Each language names itself in its own script, at its own scale and
                  direction, rather than in the interface's. */}
              <span className="language-choice-endonym" lang={item.languageTag} dir={item.direction}
                style={{ ['--script-scale' as string]: item.fontScale }}>{item.endonym}</span>
              <span className="language-choice-greeting" lang={item.languageTag} dir={item.direction}>{item.greeting.text}</span>
              <span className="language-choice-name">{languageLabel(item, locale)}</span>
            </button>
            <button type="button" role="checkbox" className="language-choice-check" aria-checked={isChosen}
              aria-label={tr('Learn {value0}', { value0: languageLabel(item, locale) })} onClick={() => toggle(item.code)}>
              {isChosen && <ToolbarIcon name="check" size={14} />}
            </button>
          </div>
        })}
      </div>

      {selected && <div className="language-chosen"><InspectText text={selected.greeting.text} language={selected.code} variety={variety} />
        <p className="language-chosen-partner">
          <span className="language-chosen-vibe" aria-hidden="true">{selected.partner.vibe[0] ?? ''}</span>
          {tr('You will be talking with {name}', { name: selected.partner.romanizedName ?? selected.partner.name })}
        </p>
        {selected.varieties.length > 1 && <div className="form-row"><span>{tr('Variety')}</span><VarietyField presets={selected.varieties} value={variety}
          onChange={value => setChoice(previous => ({ ...previous, varieties: { ...previous.varieties, [selected.code]: value } }))} /></div>}
      </div>}

      <div className="onboarding-secondary">
        <div className="form-row"><label htmlFor="setup-explanation">{tr('Explanation language')}</label><select id="setup-explanation" value={explanation} onChange={event => setExplanation(event.target.value)}>{catalog.map(item => <option key={item.code} value={item.code} lang={item.languageTag}>{languageLabel(item, locale)}</option>)}</select></div>
        <div className="form-row"><label htmlFor="setup-locale">{tr('Interface language')}</label><select id="setup-locale" value={locale} onChange={event => setLocale(event.target.value)}>{Object.entries(UI_LOCALE_METADATA).map(([id, item]) => <option key={id} value={id} lang={item.tag}>{item.endonym}</option>)}</select></div>
      </div>
    </fieldset>
  </form>
}
