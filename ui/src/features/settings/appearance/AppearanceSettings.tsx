import { DEFAULT_APPEARANCE, type AppearancePreferences } from '../../../generated/contracts'
import type { Settings } from '../../../types'
import { useI18n } from '../../../components/localization/i18n'

export function AppearanceSettings({ settings, onChange }: { settings: Settings; onChange: (settings: Settings) => void }) {
  const tr = useI18n()
  const value = settings.appearance ?? DEFAULT_APPEARANCE
  const update = (patch: Partial<AppearancePreferences>) => onChange({ ...settings, appearance: { ...value, ...patch } })
  return <div className="appearance-settings">
    <div className="appearance-options">
      <label>{tr('Theme')}<select value={settings.theme ?? 'light'} onChange={e => onChange({ ...settings, theme: e.target.value as 'light' | 'dark' | 'system' })}><option value="light">{tr('Light')}</option><option value="dark">{tr('Dark')}</option><option value="system">{tr('System')}</option></select></label>
      <label>{tr('Surface palette')}<select value={value.palette} onChange={e => update({ palette: e.target.value as AppearancePreferences['palette'] })}><option value="cool">{tr('Cool neutral')}</option><option value="warm">{tr('Warm')}</option></select></label>
      <label>{tr('Control density')}<select value={value.controlDensity} onChange={e => update({ controlDensity: e.target.value as AppearancePreferences['controlDensity'] })}><option value="standard">{tr('Standard')}</option><option value="compact">{tr('Compact')}</option></select></label>
      <label>{tr('Layout spacing')}<select value={value.layoutSpacing} onChange={e => update({ layoutSpacing: e.target.value as AppearancePreferences['layoutSpacing'] })}><option value="roomy">{tr('Roomy')}</option><option value="balanced">{tr('Balanced')}</option><option value="tight">{tr('Tight')}</option><option value="extra_tight">{tr('Extra tight')}</option></select></label>
      <label>{tr('Surface depth')}<select value={value.depth} onChange={e => update({ depth: e.target.value as AppearancePreferences['depth'] })}><option value="flat">{tr('Flat')}</option><option value="subtle">{tr('Subtle')}</option><option value="raised">{tr('Raised')}</option><option value="recessed">{tr('Recessed')}</option></select></label>
    </div>
    <details className="appearance-glow-options"><summary>{tr('Colored glow')}</summary>
      <label className="appearance-check"><input type="checkbox" checked={value.glowEnabled} onChange={e => update({ glowEnabled: e.target.checked })} />{tr('Enable glow')}</label>
      <div className="appearance-options"><label>{tr('Glow color')}<input type="color" value={value.glowColor} disabled={!value.glowEnabled} onChange={e => update({ glowColor: e.target.value })} /></label><label>{tr('Glow strength')} · {value.glowStrength}%<input aria-label={tr('Glow strength')} type="range" min="0" max="70" step="5" value={value.glowStrength} disabled={!value.glowEnabled} onChange={e => update({ glowStrength: Number(e.target.value) })} /></label></div>
    </details>
    <div className="appearance-sample"><button type="button" className="btn">{tr('Sample button')}</button><p className="target-text">{tr('Reading preview')}</p><small>{tr('Appearance changes save automatically.')}</small></div>
    <button type="button" className="btn" onClick={() => onChange({ ...settings, theme: 'light', appearance: { ...DEFAULT_APPEARANCE } })}>{tr('Reset appearance')}</button>
  </div>
}
