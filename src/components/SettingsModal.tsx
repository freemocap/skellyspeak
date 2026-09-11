import { InfoTip } from './InfoTip'
import { configureAudioVolumes } from '../lib/audio-volume'
import { configureRewardSounds } from '../lib/reward-sounds'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { Settings, Shortcuts } from '../types'
import {
  getSettings,
  logInfo,
  saveSettings,
  languages,
} from '../lib/tauri'
import { comboFromEvent, SHORTCUT_DEFAULTS, type ShortcutAction } from '../lib/keyboard'
import { DialectField } from './DialectField'
import { t, tOr, uiLangFromNative, type UiLang } from '../lib/i18n'
import { speechSupported } from '../lib/speech'
import { useIsMobile } from '../hooks/useIsMobile'
import { reportFault } from '../lib/faults'
import { openOverlay } from '../lib/back'

import { SettingsAccess } from './SettingsAccess'

type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

/// How long an edit rests before it is written. Long enough that typing into a
/// text field is one write rather than one per keystroke, short enough that
/// closing the modal straight after a change still catches it.
const AUTOSAVE_DEBOUNCE_MS = 500

type SectionId = 'keys' | 'languages' | 'voice' | 'shortcuts' | 'updates' | 'reading'

function SaveStatus({ state }: { state: SaveState }) {
  if (state === 'error')
    return (
      <span className="save-status error" role="alert">
        Not saved — check the logs
      </span>
    )
  if (state === 'saving' || state === 'pending')
    return <span className="save-status">Saving…</span>
  if (state === 'saved') return <span className="save-status saved">Saved ✓</span>
  return <span className="save-status hint">Changes save automatically</span>
}

/// Shortcut recorder: click to arm, press a combo. Esc resets to default.
function ShortcutField({
  label,
  action,
  value,
  ui,
  onChange,
}: {
  label: string
  action: ShortcutAction
  value: string
  ui: UiLang
  onChange: (v: string) => void
}) {
  const [recording, setRecording] = useState(false)
  // Shortcut labels localize via settings.sc.<action>; falls back to the
  // English label when the key is missing.
  const displayLabel = tOr(ui, 'settings.sc.' + action, label)
  return (
    <div className="shortcut-field">
      <span className="shortcut-label">{displayLabel}</span>
      <input
        data-shortcut-capture={recording || undefined}
        className="shortcut-input"
        value={recording ? 'press keys…' : value || SHORTCUT_DEFAULTS[action]}
        readOnly
        onFocus={() => setRecording(true)}
        onBlur={() => setRecording(false)}
        onKeyDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (e.key === 'Escape') {
            onChange(SHORTCUT_DEFAULTS[action])
            ;(e.target as HTMLInputElement).blur()
            return
          }
          if (e.key === 'Control' || e.key === 'Alt' || e.key === 'Shift' || e.key === 'Meta')
            return
          onChange(comboFromEvent(e))
          ;(e.target as HTMLInputElement).blur()
        }}
      />
    </div>
  )
}

const SECTIONS: { id: SectionId; labelKey: string; icon: string; descKey: string }[] = [
  { id: 'reading', labelKey: 'Reading & display', icon: 'Aa', descKey: 'Text size, spacing, and reading aids' },
  {
    id: 'keys',
    labelKey: 'AI access',
    icon: '🔑',
    descKey: 'Hosted sign-in, API keys or a custom server',
  },
  {
    id: 'languages',
    labelKey: 'settings.section.languages',
    icon: '🌐',
    descKey: 'settings.desc.languages',
  },
  {
    id: 'voice',
    labelKey: 'settings.section.voice',
    icon: '🎙',
    descKey: 'settings.desc.voice',
  },
  {
    id: 'shortcuts',
    labelKey: 'settings.section.shortcuts',
    icon: '⌨',
    descKey: 'settings.desc.shortcuts',
  },
  {
    id: 'updates',
    labelKey: 'settings.section.updates',
    icon: '⬆',
    descKey: 'settings.desc.updates',
  },
]

const SECTION_LABEL_KEY: Record<SectionId, string> = Object.fromEntries(
  SECTIONS.map((s) => [s.id, s.labelKey])
) as Record<SectionId, string>

interface RowDef {
  section: SectionId
  label: string
  kw: string
  node: ReactNode
  /// Rows that do not apply to the current configuration — e.g. the custom
  /// server fields while the provider is set to cloud. Hidden everywhere,
  /// search included: offering a field that is ignored is worse than absent.
  hidden?: boolean
}

const SHORTCUT_ROWS: { action: ShortcutAction; label: string }[] = [
  { action: 'mic', label: 'Toggle microphone' },
  { action: 'speak', label: 'Speak last reply' },
  { action: 'panel', label: 'Toggle analysis panel' },
  { action: 'settings', label: 'Open settings' },
]

const TTS_VOICES = [
  'alloy',
  'ash',
  'ballad',
  'coral',
  'echo',
  'fable',
  'nova',
  'onyx',
  'sage',
  'shimmer',
  'verse',
]

export function SettingsModal({
  onClose: closeModal,
  onSettingsChanged,
  onBusyChange,
}: {
  onClose: () => void
  onBusyChange?: (busy: boolean) => void
  /// Called after every successful autosave so the rest of the app can pick
  /// the new settings up. It does NOT mean "the user is finished" — this fires
  /// mid-edit, so nothing hung off it may close the modal.
  onSettingsChanged: (s: Settings) => void
}) {
  const [settings, setSettings] = useState<Settings | null>(null)
  useEffect(() => { if (settings) configureRewardSounds(settings.reward_sounds, settings.auto_speak) }, [settings?.reward_sounds, settings?.auto_speak])
  const [loadError, setLoadError] = useState<string | null>(null)
  useEffect(() => {
    if (!settings) return
    try { configureAudioVolumes(settings) }
    catch (error) {
      reportFault('Audio settings', error)
      setLoadError(String(error instanceof Error ? error.message : error))
      setSettings(null)
    }
  }, [settings === null, settings?.master_volume, settings?.voice_volume, settings?.effects_volume])
  // The last state known to be on disk. Autosave fires whenever `settings`
  // drifts from this, and this catches up once the write lands.
  const [persisted, setPersisted] = useState<Settings | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [accessBusy, setAccessBusy] = useState(false)
  const mics: { id: string; label: string }[] = []
  const listMics = async () => { throw new Error('Microphone selection is not connected.') }
  const [section, setSection] = useState<SectionId>('keys')
  const [search, setSearch] = useState('')
  const isMobile = useIsMobile()
  // Android's WebView ships no speechSynthesis — offer the OS voice only where
  // it can actually work, rather than letting it be picked and do nothing.
  const osVoiceAvailable = speechSupported()
  // The app's UI language follows the learner's NATIVE language.
  const ui = uiLangFromNative(settings?.native_language)

  useEffect(() => {
    logInfo('[settings] modal opened')
    void getSettings()
      .then((s) => {
        setSettings(s)
        setPersisted(s)
        logInfo('[settings] loaded')
      })
      .catch((e) => {
        reportFault('Loading settings', e)
        setLoadError(String(e instanceof Error ? e.message : e))
        setSettings(null)
      })
  }, [])

  const refreshFromBackend = useCallback(async () => {
    const fresh = await getSettings()
    setSettings(fresh); setPersisted(fresh); onSettingsChanged(fresh)
  }, [onSettingsChanged])

  // ── Autosave ────────────────────────────────────────────────────────────
  // Supported preference edits save after a short pause; access owns its own writes.
  const dirty = !!settings && !!persisted && JSON.stringify(settings) !== JSON.stringify(persisted)

  useEffect(() => {
    if (!settings || !dirty) return
    // Serialize writes and require explicit retry after failure.
    if (saveState === 'saving' || saveState === 'error') return
    const timer = setTimeout(() => {
      setSaveState('saving')
      logInfo('[settings] autosaving')
      Promise.resolve().then(async () => {
        if (!persisted) throw new Error('Settings are still loading.')
        await saveSettings(settings, persisted)
      })
        .then(() => getSettings())
        .then((fresh) => {
          setSettings(current => {
            if (!current) return fresh
            const next = { ...fresh }
            for (const key of Object.keys(current) as (keyof Settings)[]) {
              if (key !== 'scope' && JSON.stringify(current[key]) !== JSON.stringify(settings[key])) Object.assign(next, { [key]: current[key] })
            }
            return next
          })
          setPersisted(fresh)
          setSaveState('saved')
          onSettingsChanged(fresh)
        })
        .catch((e) => {
          // Preserve the draft on failure and report it in the shared fault bar.
          reportFault('Saving settings', e)
          setSaveState('error')
        })
    }, AUTOSAVE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [settings, dirty, saveState, onSettingsChanged])

  const onClose = useCallback(() => {
    if (accessBusy || dirty || saveState === 'saving') return
    closeModal()
  }, [accessBusy, dirty, saveState, closeModal])

  useEffect(() => { onBusyChange?.(accessBusy || dirty || saveState === 'saving') }, [accessBusy, dirty, saveState, onBusyChange])
  useEffect(() => openOverlay(onClose), [onClose])

  // Escape closes Settings unless a nested dialog or shortcut capture owns it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return
      // ShortcutField binds Escape to "reset this shortcut to its default";
      // while it is recording, Escape belongs to it, not to the modal.
      const active = document.activeElement as HTMLElement | null
      if (active?.hasAttribute('data-shortcut-capture')) return
      onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Let "Saved" fade back to nothing so the footer is not permanently shouting.
  useEffect(() => {
    if (saveState !== 'saved') return
    const t = setTimeout(() => setSaveState('idle'), 1800)
    return () => clearTimeout(t)
  }, [saveState])

  if (!settings) {
    return (
      <div className="modal-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose() }}>
        <div className="settings-modal" role="dialog" aria-modal="true" aria-label="Settings">
          {loadError ? <><p role="alert">{loadError}</p><button type="button" className="btn" onClick={onClose}>Close</button></> : <p className="center-note">Loading…</p>}
        </div>
      </div>
    )
  }

  const setShortcuts = (patch: Partial<Shortcuts>) =>
    setSettings({ ...settings, shortcuts: { ...settings.shortcuts, ...patch } })

  // Localized display label for a registry row (English label = search index).
  const L = (id: string, fallback: string) => tOr(ui, 'settings.row.' + id, fallback)

  // ── Row registry: adding a setting = one entry here ──────────────────────
  // Display labels localize via the settings.row.<id> convention (English
  // fallbacks double as the search index).
  const rows: Record<string, RowDef> = {
    provider_mode: {
      section: 'keys', label: 'AI access', kw: 'provider server token key account models custom hosted openrouter groq',
      node: <SettingsAccess onBusyChange={setAccessBusy} onChanged={refreshFromBackend} />,
    },
    target_language: {
      section: 'languages',
      label: L('target_language', 'I want to learn'),
      kw: 'target language learn spanish studying',
      node: (
        <div className="form-row">
          <label>I want to learn</label>
          <select
            value={settings.target_language}
            onChange={(e) => {
              // Changing language resets the dialect to that language's default.
              setSettings({ ...settings, target_language: e.target.value, target_dialect: '' })
            }}
          >
            {languages().map((l) => (
              <option key={l.code} value={l.code}>
                {l.endonym}
              </option>
            ))}
          </select>
        </div>
      ),
    },
    target_dialect: {
      section: 'languages',
      label: L('target_dialect', 'Regional variety'),
      kw: 'dialect regional variety accent region levantine mexican',
      node: (
        <div className="form-row">
          <label>Regional variety</label>
          <DialectField
            presets={
              languages().find((l) => l.code === settings.target_language)?.dialects ?? []
            }
            value={settings.target_dialect}
            onChange={(v) => setSettings({ ...settings, target_dialect: v })}
          />
        </div>
      ),
    },
    native_language: {
      section: 'languages',
      label: L('native_language', 'My native language'),
      kw: 'native language explanations mother tongue',
      node: (
        <div className="form-row">
          <label>My native language</label>
          <select
            value={settings.native_language}
            onChange={(e) => setSettings({ ...settings, native_language: e.target.value })}
          >
            {languages().map((l) => (
              <option key={l.base} value={l.base}>
                {l.endonym}
              </option>
            ))}
          </select>
        </div>
      ),
    },
    audio_volume: {
      section: 'voice', label: 'Volume', kw: 'audio master overall volume voice speech tts effects sound mute rewards',
      node: <div className="audio-volume-controls">
        {(['master_volume', 'voice_volume', 'effects_volume'] as const).map((key, index) => <div className={`audio-volume-row${index ? ' audio-volume-channel' : ''}`} key={key}>
          <label htmlFor={key}>{['Overall volume', 'Voice volume', 'Sound effects volume'][index]}</label>
          <input id={key} type="range" min="0" max="100" step="1" value={settings[key]}
            onChange={event => setSettings({ ...settings, [key]: Number(event.target.value) })} />
          <output htmlFor={key}>{settings[key]}%</output>
        </div>)}
        <div className="audio-volume-channel audio-effects-toggles">
          <label className="check-label"><input type="checkbox" checked={settings.reward_sounds !== 'no'}
            onChange={event => setSettings({ ...settings, reward_sounds: event.target.checked ? 'yes' : 'no' })} />Sound effects</label>
          {settings.reward_sounds !== 'no' && <label className="check-label"><input type="checkbox" checked={settings.reward_sounds === 'follow_tts'}
            onChange={event => setSettings({ ...settings, reward_sounds: event.target.checked ? 'follow_tts' : 'yes' })} />Only with Read aloud</label>}
        </div>
      </div>,
    },
    microphone: {
      section: 'voice',
      label: L('microphone', 'Microphone'),
      kw: 'microphone input device recording yeti',
      node: (
        <div className="form-row">
          <label>Microphone</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <select
              value={settings.microphone_device_id ?? ''}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  microphone_device_id: e.target.value || null,
                })
              }
            >
              <option value="">System default</option>
              {mics.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
            <button type="button" className="btn" onClick={() => void listMics()}>
              ↻
            </button>
          </div>
        </div>
      ),
    },
    tts_rate: {
      section: 'voice', label: 'Voice speed', kw: 'voice speech speed rate slower faster',
      node: <div className="form-row"><label htmlFor="voice-speed">Voice speed</label><select id="voice-speed" value={settings.tts_rate} onChange={event => setSettings({ ...settings, tts_rate: Number(event.target.value) })}>{[0.5, 0.65, 0.8, 1, 1.2, 1.5].map(rate => <option key={rate} value={rate}>{rate}×</option>)}</select></div>,
    },
    tts_engine: {
      section: 'voice',
      label: L('tts_engine', 'Speech engine'),
      kw: 'tts engine speech synthesis groq playai cloud voice os offline playback',
      node: (
        <div className="form-row">
          <label>Speech engine (reads replies aloud)</label>
          <select
            value={settings.tts_engine}
            onChange={(e) => setSettings({ ...settings, tts_engine: e.target.value })}
          >
            <option value="cloud">Cloud — gpt-audio-mini via OpenRouter (natural)</option>
            <option value="os" disabled={!osVoiceAvailable}>
              OS voice (offline){osVoiceAvailable ? '' : ' — not available on this platform'}
            </option>
          </select>
          {!osVoiceAvailable && (
            <p className="field-note">
              This webview has no speech synthesis of its own (Android), so replies are
              read aloud by the cloud engine.
            </p>
          )}
        </div>
      ),
    },
    tts_voice: {
      section: 'voice',
      label: 'Cloud voice without a persona',
      kw: 'cloud voice actor narrator openai alloy nova',
      node: (
        <div className="form-row">
          <label>Cloud voice without a persona</label>
          <select
            value={settings.tts_voice}
            onChange={(e) => setSettings({ ...settings, tts_voice: e.target.value })}
          >
            {TTS_VOICES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <InfoTip>Saved personas use their own stable voice. This selection applies to conversations without a persona. Persona traits guide delivery; installed OS voices are matched by language and stable identity, not age or gender.</InfoTip>
        </div>
      ),
    },
    auto_speak: {
      section: 'voice',
      label: L('auto_speak', 'Auto-speak tutor replies'),
      kw: 'auto speak tts voice speech playback audio read aloud',
      node: (
        <div className="form-row check-row">
          <label className="check-label">
            <input
              type="checkbox"
              checked={settings.auto_speak}
              onChange={(e) => setSettings({ ...settings, auto_speak: e.target.checked })}
            />
            <span>Read partner replies aloud</span>
          </label>
        </div>
      ),
    },
    auto_send: {
      section: 'voice',
      label: L('auto_send', 'Auto-send transcriptions'),
      kw: 'auto send transcription mic speech stt voice input',
      node: (
        <div className="form-row check-row">
          <label className="check-label">
            <input
              type="checkbox"
              checked={settings.auto_send}
              onChange={(e) => setSettings({ ...settings, auto_send: e.target.checked })}
            />
            <span>Send after stopping the microphone</span>
          </label>
        </div>
      ),
    },
    text_size: {
      section: 'reading', label: 'Text size', kw: 'font text size reading display accessibility',
      node: <div className="form-row"><label htmlFor="reading-size">Text size · {settings.text_size}%</label>
        <input id="reading-size" type="range" min="75" max="150" step="5" value={settings.text_size} onChange={event => setSettings({ ...settings, text_size: Number(event.target.value) })} />
      </div>,
    },

    always_romanize: {
      section: 'reading',
      label: L('always_romanize', 'Always show romanization'),
      kw: 'romanization always show latin arabic pinyin pronunciation',
      node: (
        <div className="form-row check-row">
          <label className="check-label">
            <input
              type="checkbox"
              checked={settings.always_romanize}
              onChange={(e) => setSettings({ ...settings, always_romanize: e.target.checked })}
            />
            <span>Show romanization</span>
          </label>
        </div>
      ),
    },
    fast_mode: {
      section: 'reading',
      label: 'Fast mode',
      kw: 'xp reward cards fast mode animation dismiss progress',
      node: <div className="form-row check-row"><label className="check-label">
        <input type="checkbox" checked={settings.fast_mode}
          onChange={event => setSettings({ ...settings, fast_mode: event.target.checked })} />
        <span>Fast mode · dismiss XP cards automatically</span>
      </label></div>,
    },
    always_pronunciation: {
      section: 'reading',
      label: 'Always show pronunciation',
      kw: 'pronunciation phonetic reading coach reply',
      node: <div className="form-row check-row"><label className="check-label">
        <input type="checkbox" checked={settings.always_pronunciation}
          onChange={event => setSettings({ ...settings, always_pronunciation: event.target.checked })} />
        <span>Show pronunciation</span>
      </label></div>,
    },
    auto_translate: {
      section: 'reading',
      label: 'Token translations',
      kw: 'translation always show native meaning under reply',
      node: (
        <div className="form-row check-row">
          <label className="check-label">
            <input
              type="checkbox"
              checked={settings.auto_translate}
              onChange={(e) => setSettings({ ...settings, auto_translate: e.target.checked })}
            />
            <span>Show token translations</span>
          </label>
        </div>
      ),
    },
    app_updates: {
      section: 'updates',
      label: L('app_updates', 'Application updates'),
      kw: 'update updates upgrade version release install newer check',
      node: <div className="form-row"><button type="button" className="btn" onClick={() => window.dispatchEvent(new Event('skellyspeak-check-update'))}>Check for updates</button><InfoTip>Desktop updates install in the app. Android updates open the APK download page. Development builds do not install updates.</InfoTip><button type="button" className="btn" onClick={() => { void import('@tauri-apps/plugin-opener').then(({ openUrl }) => openUrl('https://docs.freemocap.org/skellyspeak/download')).catch(error => reportFault('Opening downloads', error)) }}>Downloads</button></div>,
    },
  }
  for (const sr of SHORTCUT_ROWS) {
    rows[`shortcut_${sr.action}`] = {
      section: 'shortcuts',
      label: sr.label,
      kw: `keyboard shortcut hotkey key combo ${sr.label}`,
      node: (
        <div className="form-row">
        <ShortcutField
          label={sr.label}
          ui={ui}
          action={sr.action}
            value={settings.shortcuts[sr.action]}
            onChange={(v) => setShortcuts({ [sr.action]: v })}
          />
        </div>
      ),
    }
  }

  const supported = new Set(['app_updates', 'tts_rate', 'fast_mode', 'audio_volume', 'auto_send', 'auto_speak', 'provider_mode', 'target_language', 'target_dialect', 'native_language', 'text_size', 'always_romanize', 'always_pronunciation', 'auto_translate'])
  for (const [id, row] of Object.entries(rows)) {
    if (!supported.has(id)) row.node = <fieldset disabled><p className="field-note">Not connected.</p>{row.node}</fieldset>
    else if (id !== 'provider_mode' && accessBusy) row.node = <fieldset disabled>{row.node}</fieldset>
  }

  const q = search.trim().toLowerCase()
  const searching = q.length > 0
  const allRows = Object.entries(rows).filter(([, r]) => !r.hidden).sort(([, a], [, b]) => SECTIONS.findIndex(group => group.id === a.section) - SECTIONS.findIndex(group => group.id === b.section))
  // Mobile groups settings in collapsible sections; search exposes matching rows.
  const stacked = isMobile && !searching
  const visibleRows = searching
    ? allRows.filter(
        ([, r]) => r.label.toLowerCase().includes(q) || r.kw.includes(q)
      )
    : stacked
      ? allRows
      : allRows.filter(([, r]) => r.section === section)

  const activeSection = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0]
  // A heading is printed wherever the section changes going down the list —
  // while searching to show where a hit came from, while stacked to divide the
  // one long scroll into the same groups the desktop nav has. Resolved here,
  // not during the map, so nothing mutates while rendering.
  const showGroupHeadings = searching || stacked
  let runningSection: SectionId | null = null
  const renderRows = visibleRows.map(([id, row]) => {
    const heading = showGroupHeadings && row.section !== runningSection ? row.section : null
    runningSection = row.section
    return { id, row, heading }
  })

  return (
    <div className="modal-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose() }}>
      <div
        className="settings-modal" role="dialog" aria-modal="true" aria-label="Settings"
        onFocusCapture={(e) => {
          const t = e.target as HTMLElement
          if (t.tagName === 'INPUT' || t.tagName === 'SELECT') {
            t.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
          }
        }}
      >
        <aside className="settings-nav">
          <input
            className="settings-search"
            placeholder="Search settings…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search settings"
            disabled={accessBusy || dirty || saveState === 'saving'}
          />
          {!isMobile && (
            <nav className="settings-tree">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  disabled={accessBusy || dirty || saveState === 'saving'}
                  type="button"
                  className={`nav-item ${!searching && section === s.id ? 'active' : ''}`}
                  onClick={() => {
                    setSearch('')
                    setSection(s.id)
                  }}
                >
                  <span className="nav-icon">{s.icon}</span>
                  {tOr(ui, s.labelKey, s.labelKey)}
                </button>
              ))}
            </nav>
          )}
        </aside>
        <main className="settings-content">
          <div className="settings-head">
            <h2>{searching ? `“${search.trim()}”` : t(ui, 'settings.title')}</h2>
            <p className="sub">
              {searching
                ? `${visibleRows.length} ${t(ui, 'settings.matches')}`
                : stacked
                  ? tOr(ui, 'settings.subtitle', 'Expand a section to adjust its settings.')
                  : tOr(ui, activeSection.descKey, activeSection.descKey)}
            </p>
          </div>
          <div className="settings-scroll" inert={saveState === 'saving'}>
            {searching && visibleRows.length === 0 && (
              <p className="center-note">Nothing matches “{search.trim()}”.</p>
            )}
            {stacked ? SECTIONS.map(group => <details className="settings-section" key={group.id} open={group.id === 'reading'}>
              <summary>{tOr(ui, group.labelKey, group.labelKey)}</summary>
              {allRows.filter(([, row]) => row.section === group.id).map(([id, row]) => <div key={id} className="settings-entry">{row.node}</div>)}
            </details>) : renderRows.map(({ id, row, heading }) => (
              <div key={id} className="settings-entry">
                {heading && (
                  <p className="settings-group-k">{tOr(ui, SECTION_LABEL_KEY[heading], SECTION_LABEL_KEY[heading])}</p>
                )}
                {row.node}
              </div>
            ))}
            {!searching && visibleRows.length === 0 && (
              <p className="center-note">Nothing here yet.</p>
            )}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn danger" disabled title="Reset is not connected">Reset settings</button>
            <SaveStatus state={dirty && saveState === 'idle' ? 'pending' : saveState} />
            {saveState === 'error' && <button className="btn" onClick={() => setSaveState('idle')}>Retry save</button>}
            <button type="button" className="btn" disabled={accessBusy || dirty || saveState === 'saving'} onClick={onClose}>
              Close
            </button>
          </div>
        </main>
      </div>
    </div>
  )
}
