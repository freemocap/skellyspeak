import { ErrorNotice } from '../../components/feedback/ErrorNotice'
import { errorMessage as errorText } from '../../platform/diagnostics/error-details'
import { languageBadgeSample } from '../../domain/language/script-text'
import { InspectText } from '../../components/reading/InspectText'
import { useEffect, useId, useState } from 'react'
import { DetailDialog } from '../../components/dialogs/DetailDialog'
import { useI18n } from '../../components/localization/i18n'
import { languageLabel } from '../../domain/language/language-label'
import { translatedName } from '../../domain/localization'
import { inspectLanguage } from '../../platform/ipc/content'
import { languages } from '../../platform/ipc/tauri'
import { useSettingsStore } from '../../state/settings/settings'
import type { LanguageInspection } from '../../generated/contracts'
import { LanguageDetails } from './LanguageDetails'

/** Checkboxes save membership immediately; inspecting a language does not switch chats. */
export function LanguageBrowser({ onClose, initialLanguage }: { onClose: () => void; initialLanguage?: string | null }) {
  const tr = useI18n()
  const settings = useSettingsStore(state => state.settings)
  const savingLanguage = useSettingsStore(state => state.savingLanguage)
  const catalog = languages()
  const [language, setLanguage] = useState(initialLanguage ?? settings?.target_language ?? catalog[0].code)
  const selected = catalog.find(item => item.code === language)!
  const [variety, setVariety] = useState(language === settings?.target_language ? settings.target_variety : settings?.target_varieties[language] ?? selected.defaultVariety)
  const explanation = settings?.native_language ?? catalog[0].code
  const explanationVariety = settings?.native_variety ?? catalog.find(item => item.code === explanation)!.defaultVariety
  const viewId = useId()
  const [onlyMine, setOnlyMine] = useState(false)
  const myLanguages = new Set([...(settings?.my_languages ?? []), ...(settings ? [settings.target_language] : [])])
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<'added' | 'removed' | null>(null)
  const [query, setQuery] = useState('')
  const [inspection, setInspection] = useState<{ key: string; report: LanguageInspection } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [attempt, setAttempt] = useState(0)
  // Effects run after render: never pair a previous response with the new selection.
  const inspectionKey = JSON.stringify([language, variety, explanation, explanationVariety, attempt])
  const report = inspection?.key === inspectionKey ? inspection.report : null
  useEffect(() => {
    let active = true
    setInspection(null); setError(null)
    void inspectLanguage(language, variety, explanation, explanationVariety).then(value => {
      if (active) setInspection({ key: inspectionKey, report: value })
    }).catch((reason: unknown) => { if (active) setError(errorText(reason)) })
    return () => { active = false }
  }, [language, variety, explanation, explanationVariety, inspectionKey])
  async function changeMembership(code: string, checked: boolean) {
    if (saving || savingLanguage) return
    const definition = catalog.find(item => item.code === code)!
    const remembered = settings?.target_varieties[code] ?? definition.defaultVariety
    setSaving(true); setActionError(null); setNotice(null)
    try {
      await useSettingsStore.getState().saveMyLanguage(code, checked ? remembered : null)
      setNotice(checked ? 'added' : 'removed')
    } catch (reason) { setActionError(errorText(reason)) }
    finally { setSaving(false) }
  }
  const matches = catalog.filter(item => (!onlyMine || myLanguages.has(item.code)) && `${translatedName(tr.locale, item.name)} ${item.name} ${item.endonym} ${item.code}`.toLowerCase().includes(query.toLowerCase()))
  return <DetailDialog title={tr('Languages')} size="wide" onClose={onClose}>
    <div className="language-browser">
      <h2>{tr('Languages')}</h2>
      <div className="panel-tabs" role="tablist" aria-label={tr('Languages')} onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const next = event.key === 'Home' ? false : event.key === 'End' ? true : !onlyMine
        setOnlyMine(next)
        event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next ? 1 : 0].focus()
      }}>
        <button type="button" role="tab" id={`${viewId}-all`} aria-controls={`${viewId}-panel`} className={`panel-tab${!onlyMine ? ' active' : ''}`} aria-selected={!onlyMine} tabIndex={!onlyMine ? 0 : -1} onClick={() => setOnlyMine(false)}>{tr('All languages')}</button>
        <button type="button" role="tab" id={`${viewId}-mine`} aria-controls={`${viewId}-panel`} className={`panel-tab${onlyMine ? ' active' : ''}`} aria-selected={onlyMine} tabIndex={onlyMine ? 0 : -1} onClick={() => setOnlyMine(true)}>{tr('My languages')}</button>
      </div>
      <div className="language-browser-layout" role="tabpanel" id={`${viewId}-panel`} aria-labelledby={`${viewId}-${onlyMine ? 'mine' : 'all'}`}>
        <nav aria-label={tr('Languages')} className="language-browser-list">
          <input className="field" type="search" aria-label={tr('Search languages')} placeholder={tr('Search languages')} value={query} onChange={event => setQuery(event.target.value)} />
          <div className="language-browser-grid">
          {matches.map(item => <div className="language-browser-tile" key={item.code}>
            <input type="checkbox" aria-label={languageLabel(item, tr.locale)}
              checked={myLanguages.has(item.code)}
              disabled={item.code === settings?.target_language || saving || savingLanguage}
              title={item.code === settings?.target_language ? tr('Switch languages before removing the current language.') : undefined}
              onChange={event => void changeMembership(item.code, event.target.checked)} />
            <button type="button" className="language-browser-item" aria-current={language === item.code ? 'true' : undefined}
              aria-label={languageLabel(item, tr.locale)} disabled={saving || savingLanguage} onClick={() => { setLanguage(item.code); setVariety(item.code === settings?.target_language ? settings.target_variety : settings?.target_varieties[item.code] ?? item.defaultVariety); setActionError(null); setNotice(null) }}>
              <LanguageBadge languageTag={item.languageTag} endonym={item.endonym} />
              <span className="language-browser-names"><strong lang={item.languageTag} dir="auto">{item.endonym}</strong><small>{translatedName(tr.locale, item.name)}</small></span>
            </button>
          </div>)}
          </div>
          {matches.length === 0 && <p>{tr('No matching languages')}</p>}
          {saving && <p role="status">{tr('Saving…')}</p>}
          {notice && <p role="status">{notice === 'added' ? tr('Language added. Your current conversation is unchanged.') : tr('Language removed from My languages.')}</p>}
          {actionError && <ErrorNotice as="p" error={actionError}>{actionError}</ErrorNotice>}
        </nav>
        <section className="language-browser-detail" aria-label={selected.name}>
          <div className="language-browser-overview">
          <header className="language-browser-hero">
            <LanguageBadge languageTag={selected.languageTag} endonym={selected.endonym} large />
            <h3><span dir="auto" lang={selected.languageTag}>{selected.endonym}</span><InspectText text={selected.endonym} language={selected.code} variety={variety} />{selected.endonym !== translatedName(tr.locale, selected.name) && <small>{translatedName(tr.locale, selected.name)}</small>}</h3>
          </header>
          <label>{tr('Variety')}<select className="field" value={variety} disabled={saving || savingLanguage} onChange={event => { setVariety(event.target.value); setActionError(null); setNotice(null) }}>
            {selected.varieties.map(item => <option key={item.id} value={item.id}>{translatedName(tr.locale, item.label)}</option>)}
          </select></label>
          </div>
          {error && <ErrorNotice as="div" error={error}><p>{error}</p><button type="button" className="btn" onClick={() => setAttempt(value => value + 1)}>{tr('Retry')}</button></ErrorNotice>}
          {!report && !error && <p role="status">{tr('Loading…')}</p>}
          {report && <LanguageDetails report={report} key={inspectionKey} />}
        </section>
      </div>
    </div>
  </DetailDialog>
}
/** A neutral script sample, not a flag: languages are not countries. */
function LanguageBadge({ endonym, languageTag, large = false }: { endonym: string; languageTag?: string; large?: boolean }) {
  const glyph = languageBadgeSample(endonym)
  return <span className={`language-badge${large ? ' large' : ''}`} aria-hidden="true" lang={languageTag} dir="auto">{glyph}</span>
}
