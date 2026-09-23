import { ErrorNotice } from '../../components/feedback/ErrorNotice'
import { nativeError } from '../../platform/ipc/workspace'
import { useLayoutEffect, useRef, useState } from 'react'
import { useI18n } from '../../components/localization/i18n'
import { useSettingsStore } from '../../state/settings/settings'

/** Decimal entry saves on blur/Enter; dragging saves once on release. */
export function ScriptSize({ language, defaultScale }: { language: string; defaultScale: number }) {
  const tr = useI18n()
  const scale = useSettingsStore(state => state.settings?.script_scales?.[language])
  const busy = useSettingsStore(state => state.savingLanguage)
  const [draft, setDraft] = useState(String(scale ?? defaultScale))
  const [error, setError] = useState('')
  const saving = useRef(false)
  const sliderChanged = useRef(false)
  // Synchronize before interaction: a deferred mount effect can overwrite an early edit.
  useLayoutEffect(() => { setDraft(String(scale ?? defaultScale)) }, [scale, defaultScale, language])

  async function save(next: number | null) {
    if (saving.current || busy || (next === null ? scale === undefined : next === (scale ?? defaultScale))) return
    saving.current = true
    setError('')
    try {
      await useSettingsStore.getState().saveScriptScale(language, next)
      setDraft(String(next ?? defaultScale))
    } catch (reason) { setError(nativeError(reason)) }
    finally { saving.current = false }
  }
  function commit(input: HTMLInputElement) {
    if (!input.checkValidity()) { setError(input.validationMessage); return }
    void save(input.valueAsNumber)
  }
  function commitSlider(input: HTMLInputElement) {
    if (!sliderChanged.current) return
    sliderChanged.current = false
    commit(input)
  }
  return <div className="language-script-size">
    <label>{tr('Script size')}
      <span className="language-script-number">
        <input className="field" type="number" inputMode="decimal" min="0.5" max="3" step="any" required
          value={draft} disabled={busy} aria-invalid={!!error}
          onChange={event => { setDraft(event.target.value); setError('') }}
          onBlur={event => commit(event.currentTarget)}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() } }} />
        <span aria-hidden="true">×</span>
      </span>
    </label>
    <input type="range" aria-label={tr('Script size')} min="0.5" max="3" step="0.01"
      value={Number(draft) || defaultScale} disabled={busy}
      onChange={event => { sliderChanged.current = true; setDraft(event.target.value); setError('') }}
      onPointerUp={event => commitSlider(event.currentTarget)}
      onKeyUp={event => commitSlider(event.currentTarget)}
      onBlur={event => commitSlider(event.currentTarget)} />
    <button type="button" className="inspection-action" disabled={busy || scale === undefined}
      onPointerDown={event => event.preventDefault()} onClick={() => void save(null)}>
      {tr('Default')} ({tr.number(defaultScale)}×)
    </button>
    {error && <ErrorNotice as="p" error={error}>{error}</ErrorNotice>}
  </div>
}
