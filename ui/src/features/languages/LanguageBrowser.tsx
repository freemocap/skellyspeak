import { useEffect, useId, useRef, useState } from 'react'
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
  const viewId = useId()
  const [onlyMine, setOnlyMine] = useState(false)
  const myLanguages = new Set([...(settings?.my_languages ?? []), ...(settings ? [settings.target_language] : [])])
  const added = myLanguages.has(language)
  const active = settings?.target_language === language
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<'added' | 'removed' | null>(null)
  const primaryAction = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (notice) primaryAction.current?.focus() }, [notice])
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
    setSaving(true); setActionError(null); setNotice(null)
    try {
      await useSettingsStore.getState().selectLanguageVariety(language, variety)
      onClose()
    } catch (reason) { setActionError(errorText(reason)) }
    finally { setSaving(false) }
  }
  async function changeMembership(remove = false) {
    if (saving || savingLanguage) return
    setSaving(true); setActionError(null); setNotice(null)
    try {
      await useSettingsStore.getState().saveMyLanguage(language, remove ? null : variety)
      setNotice(remove ? 'removed' : 'added')
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
          {matches.map(item => <button type="button" className="language-browser-item" key={item.code} aria-current={language === item.code ? 'true' : undefined}
            aria-label={languageLabel(item, tr.locale)} disabled={saving || savingLanguage} onClick={() => { setLanguage(item.code); setVariety(item.code === settings?.target_language ? settings.target_variety : settings?.target_varieties[item.code] ?? item.defaultVariety); setActionError(null); setNotice(null) }}>
            <LanguageBadge endonym={item.endonym} />
            <span className="language-browser-names"><strong dir="auto">{item.endonym}</strong><small>{translatedName(tr.locale, item.name)}</small></span>
            {myLanguages.has(item.code) && <span className="language-browser-current">{tr('Added')}</span>}
          </button>)}
          {matches.length === 0 && <p>{tr('No matching languages')}</p>}
        </nav>
        <section className="language-browser-detail" aria-label={selected.name}>
          <header className="language-browser-hero">
            <LanguageBadge endonym={selected.endonym} large />
            <h3><span dir="auto">{selected.endonym}</span>{selected.endonym !== translatedName(tr.locale, selected.name) && <small>{translatedName(tr.locale, selected.name)}</small>}</h3>
          </header>
          <label>{tr('Variety')}<select className="field" value={variety} disabled={saving || savingLanguage} onChange={event => { setVariety(event.target.value); setActionError(null); setNotice(null) }}>
            {selected.varieties.map(item => <option key={item.id} value={item.id}>{translatedName(tr.locale, item.label)}</option>)}
          </select></label>
          <div className="language-browser-actions">
            {!added && <button type="button" className="btn primary" ref={primaryAction} disabled={!report || saving || savingLanguage} onClick={() => void changeMembership()}>{saving ? tr('Saving…') : tr('Add language')}</button>}
            {added && <>
              <button type="button" className="btn primary" ref={primaryAction} disabled={!report || saving || savingLanguage} onClick={() => void select()}>{saving ? tr('Saving…') : tr('Use now')}</button>
              <button type="button" className="btn" disabled={active || saving || savingLanguage} onClick={() => void changeMembership(true)}>{tr('Remove from My languages')}</button>
            </>}
          </div>
          {added && <p className="field-note">{active ? tr('Switch languages before removing the current language.') : tr('Removing a language keeps its conversations and progress.')}</p>}
          {notice && <p role="status">{notice === 'added' ? tr('Language added. Your current conversation is unchanged.') : tr('Language removed from My languages.')}</p>}
          {actionError && <p role="alert">{actionError}</p>}
          {error && <div role="alert"><p>{error}</p><button type="button" className="btn" onClick={() => setAttempt(value => value + 1)}>{tr('Retry')}</button></div>}
          {!report && !error && <p role="status">{tr('Loading…')}</p>}
          {report && <details><summary>{tr("Language details")}</summary><LanguageDetails report={report} /></details>}
        </section>
      </div>
    </div>
  </DetailDialog>
}
/** A neutral script sample, not a flag: languages are not countries. */
function LanguageBadge({ endonym, large = false }: { endonym: string; large?: boolean }) {
  const latinLike = /^[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}]/u.test(endonym)
  const glyph = latinLike ? endonym.slice(0, 2) : [...endonym][0]
  return <span className={`language-badge${large ? ' large' : ''}`} aria-hidden="true" dir="auto">{glyph}</span>
}
function errorText(reason: unknown): string {
  if (reason && typeof reason === 'object' && 'message' in reason) return String(reason.message)
  return String(reason)
}
