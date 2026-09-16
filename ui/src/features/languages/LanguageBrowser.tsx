import { useEffect, useState } from 'react'
import { DetailDialog } from '../../components/dialogs/DetailDialog'
import { useI18n } from '../../components/localization/i18n'
import { languageLabel } from '../../domain/language/language-label'
import { translatedName } from '../../domain/localization'
import { inspectLanguage } from '../../platform/ipc/content'
import { languages } from '../../platform/ipc/tauri'
import { useSettingsStore } from '../../state/settings/settings'
import type { LanguageInspection } from '../../generated/contracts'
import { LanguageDetails } from './LanguageDetails'

/** Browsing never mutates preferences. Only the explicit selection action writes. */
export function LanguageBrowser({ onClose }: { onClose: () => void }) {
  const tr = useI18n()
  const settings = useSettingsStore(state => state.settings)
  const savingLanguage = useSettingsStore(state => state.savingLanguage)
  const catalog = languages()
  const [language, setLanguage] = useState(settings?.target_language ?? catalog[0].code)
  const selected = catalog.find(item => item.code === language)!
  const [variety, setVariety] = useState(settings?.target_variety ?? selected.defaultVariety)
  const explanation = settings?.native_language ?? catalog[0].code
  const explanationVariety = settings?.native_variety ?? catalog.find(item => item.code === explanation)!.defaultVariety
  const [query, setQuery] = useState('')
  const [report, setReport] = useState<LanguageInspection | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setReport(null); setError(null)
    void inspectLanguage(language, variety, explanation, explanationVariety).then(value => {
      if (active) setReport(value)
    }).catch((reason: unknown) => { if (active) setError(errorText(reason)) })
    return () => { active = false }
  }, [language, variety, explanation, explanationVariety, attempt])
  async function select() {
    if (saving || savingLanguage) return
    setSaving(true); setError(null)
    try {
      await useSettingsStore.getState().selectLanguageVariety(language, variety)
      onClose()
    } catch (reason) { setError(errorText(reason)) }
    finally { setSaving(false) }
  }
  const matches = catalog.filter(item => `${item.name} ${item.endonym} ${item.code}`.toLowerCase().includes(query.toLowerCase()))
  return <DetailDialog title={tr('Browse languages')} size="wide" onClose={onClose}>
    <div className="language-browser">
      <h2>{tr('Browse languages')}</h2>
      <div className="language-browser-layout">
        <nav aria-label={tr('Languages')} className="language-browser-list">
          <input className="field" type="search" aria-label={tr('Search languages')} placeholder={tr('Search languages')} value={query} onChange={event => setQuery(event.target.value)} />
          {matches.map(item => <button type="button" className="btn" key={item.code} aria-current={language === item.code ? 'true' : undefined}
            onClick={() => { setLanguage(item.code); setVariety(item.defaultVariety) }}>{languageLabel(item, tr.locale)}</button>)}
          {matches.length === 0 && <p>{tr('No matching languages')}</p>}
        </nav>
        <section className="language-browser-detail" aria-label={selected.name}>
          <h3>{languageLabel(selected, tr.locale)}</h3>
          <label>{tr('Variety')}<select className="field" value={variety} onChange={event => setVariety(event.target.value)}>
            {selected.varieties.map(item => <option key={item.id} value={item.id}>{translatedName(tr.locale, item.label)}</option>)}
          </select></label>
          <button type="button" className="btn" disabled={!report || saving || savingLanguage} onClick={() => void select()}>{saving ? tr('Saving…') : tr('Use this language and variety')}</button>
          {error && <div role="alert"><p>{error}</p><button type="button" className="btn" onClick={() => setAttempt(value => value + 1)}>{tr('Retry')}</button></div>}
          {!report && !error && <p role="status">{tr('Loading…')}</p>}
          {report && <LanguageDetails report={report} />}
        </section>
      </div>
    </div>
  </DetailDialog>
}
function errorText(reason: unknown): string {
  if (reason && typeof reason === 'object' && 'message' in reason) return String(reason.message)
  return String(reason)
}
