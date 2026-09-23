import { ErrorNotice } from '../../../components/feedback/ErrorNotice'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { translatedName } from '../../../domain/localization'
import { useI18n } from '../../../components/localization/i18n'
import { languages } from '../../../platform/ipc/tauri'
import { languageLabel } from '../../../domain/language/language-label'
import { useNavigationStore } from '../../../state/navigation/navigation'
import { useSettingsStore, type LanguageField } from '../../../state/settings/settings'

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

/// Global target-language selection; native save selects or creates its conversation.
export function LearningPicker() {
  const tr = useI18n()
  const { settings, saving, disabled } = usePicker()
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [submenuPosition, setSubmenuPosition] = useState({ left: 0, top: 0, width: 0 })
  const submenu = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const resized = () => { setOpen(false); setExpanded(null) }
    document.addEventListener('pointerdown', dismiss)
    window.addEventListener('resize', resized)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      window.removeEventListener('resize', resized)
    }
  }, [])
  useLayoutEffect(() => {
    if (!expanded || !submenu.current) return
    const bounds = submenu.current.getBoundingClientRect()
    if (bounds.bottom > window.innerHeight) {
      setSubmenuPosition(position => ({ ...position, top: Math.max(0, window.innerHeight - bounds.height) }))
    }
  }, [expanded, submenuPosition.top])
  function expand(language: string, row: HTMLElement) {
    const bounds = root.current!.getBoundingClientRect()
    const rowBounds = row.getBoundingClientRect()
    const width = Math.min(bounds.width, window.innerWidth / 2)
    const rtl = getComputedStyle(row).direction === 'rtl'
    const rightFits = bounds.right + width <= window.innerWidth
    const leftFits = bounds.left >= width
    const left = rtl
      ? leftFits || !rightFits ? bounds.left - width : bounds.right
      : rightFits || !leftFits ? bounds.right : bounds.left - width
    setSubmenuPosition({ left: Math.max(0, Math.min(left, window.innerWidth - width)), top: rowBounds.top, width })
    setExpanded(language)
  }
  if (!settings) return null
  const catalog = languages()
  const selected = catalog.find(item => item.code === settings.target_language)!
  const selectedVariety = selected.varieties.find(item => item.id === settings.target_variety)
  async function choose(language: string, variety: string) {
    setError('')
    try {
      await useSettingsStore.getState().selectLanguageVariety(language, variety)
      setOpen(false)
      trigger.current?.focus()
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
  }
  return <>
    <div className="language-dropdown" ref={root} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
    }} onKeyDown={event => {
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        const container = (event.target as HTMLElement).closest('.language-dropdown-varieties, .language-dropdown-panel')
        if (container) {
          const buttons = [...container.querySelectorAll<HTMLButtonElement>(container === submenu.current ? 'button' : ':scope > .language-dropdown-group > button, :scope > button')]
          const index = buttons.indexOf(event.target as HTMLButtonElement)
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
          event.preventDefault()
          buttons[next]?.focus()
        } else if (event.key === 'ArrowDown') {
          event.preventDefault(); setOpen(true); setExpanded(null)
          requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>('.language-dropdown-row')?.focus())
        }
      }
      if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); trigger.current?.focus() }
    }}>
      <button type="button" className="learning-picker" ref={trigger} aria-label={tr('Target language')}
        aria-expanded={open} aria-controls={id} disabled={disabled} onClick={() => { setExpanded(null); setOpen(!open) }}>
        <span className="learning-picker-identity">
          <span lang={selected.languageTag}>{languageLabel(selected, tr.locale)}</span>
          <small>{selectedVariety && translatedName(tr.locale, selectedVariety.label)}</small>
        </span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && <div id={id} className="language-dropdown-panel" onScroll={() => setExpanded(null)}>
        {catalog.filter(item => settings.my_languages.includes(item.code) || item.code === settings.target_language).map(item => {
          const remembered = item.code === settings.target_language ? settings.target_variety : settings.target_varieties[item.code] ?? item.defaultVariety
          return <div className="language-dropdown-group" key={item.code}>
            <button type="button" className="language-dropdown-row" disabled={disabled}
              aria-current={settings.target_language === item.code ? 'true' : undefined}
              aria-expanded={expanded === item.code} aria-controls={id + item.code}
              onMouseEnter={event => expand(item.code, event.currentTarget)}
              onClick={event => expand(item.code, event.currentTarget)}
              onKeyDown={event => {
                if (event.key === 'ArrowRight') {
                  event.preventDefault()
                  expand(item.code, event.currentTarget)
                  requestAnimationFrame(() => submenu.current?.querySelector<HTMLButtonElement>('button')?.focus())
                }
              }}>
              <span className="language-dropdown-check" aria-hidden="true">{settings.target_language === item.code ? '✓' : ''}</span>
              <span className="language-dropdown-label" lang={item.languageTag}>{languageLabel(item, tr.locale)}</span><span aria-hidden="true">▸</span>
            </button>
            <button type="button" className="language-dropdown-info" disabled={disabled}
              aria-label={tr('Information') + ': ' + languageLabel(item, tr.locale)}
              title={tr('Information')} onClick={() => {
                setOpen(false)
                useNavigationStore.getState().showLanguageInfo(item.code)
              }}><span aria-hidden="true">ⓘ</span></button>
            {expanded === item.code && <div className="language-dropdown-varieties" ref={submenu}
              style={submenuPosition} id={id + item.code} role="group" aria-label={tr('Variety')}
              onKeyDown={event => {
                if (event.key === 'ArrowLeft') {
                  event.preventDefault(); event.stopPropagation()
                  event.currentTarget.parentElement?.querySelector<HTMLButtonElement>('.language-dropdown-row')?.focus()
                  setExpanded(null)
                }
              }}>
              {item.varieties.map(variety => <button type="button" key={variety.id} disabled={disabled}
                aria-pressed={remembered === variety.id} onClick={() => void choose(item.code, variety.id)}>
                <span className="language-dropdown-check" aria-hidden="true">{remembered === variety.id ? '✓' : ''}</span>
                <span className="language-dropdown-label">{translatedName(tr.locale, variety.label)}</span>
              </button>)}
            </div>}
          </div>
        })}
        <button type="button" className="language-dropdown-add" disabled={disabled} onMouseEnter={() => setExpanded(null)} onClick={() => {
          setOpen(false); useNavigationStore.getState().showOverlay('languages')
        }}>{tr('Add language…')}</button>
        {error && <ErrorNotice as="p" error={error}>{error}</ErrorNotice>}
      </div>}
    </div>
    {saving && <span role="status" className="learning-saving">{tr('Saving…')}</span>}
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
    <label><span>{tr("Explanation language")}</span><select className="chat-language-picker" aria-label={tr("Native language")} value={settings.native_language}
      disabled={disabled} onChange={event => change('native_language', event.target.value)}>
      {languages().filter((language, index, all) => all.findIndex(item => item.base === language.base) === index).map(language => <option lang={language.languageTag} key={language.base} value={language.base}>{languageLabel(language, tr.locale)}</option>)}
    </select></label>
  )
}
