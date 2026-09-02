import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Settings, Shortcuts } from '../types'
import {
  getSettings,
  logInfo,
  saveSettings,
  resetSettings,
  validateKey,
  languages,
} from '../lib/tauri'
import { comboFromEvent, SHORTCUT_DEFAULTS, type ShortcutAction } from '../lib/keyboard'
import { DialectField } from './DialectField'
import { t, tOr, uiLangFromNative, type UiLang } from '../lib/i18n'
import { displaySecret } from '../lib/secrets'
import { speechSupported } from '../lib/speech'
import { useIsMobile } from '../hooks/useIsMobile'
import { reportFault } from '../lib/faults'

type KeyCheck = { state: 'idle' | 'checking' | 'valid' | 'invalid'; detail: string }

type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

/// How long an edit rests before it is written. Long enough that typing into a
/// text field is one write rather than one per keystroke, short enough that
/// closing the modal straight after a change still catches it.
const AUTOSAVE_DEBOUNCE_MS = 500

type SectionId = 'keys' | 'models' | 'languages' | 'voice' | 'shortcuts'

function KeyBadge({ check }: { check: KeyCheck }) {
  if (check.state === 'idle') return null
  if (check.state === 'checking')
    return (
      <span className="key-badge checking" title="checking key…">
        ⟳
      </span>
    )
  if (check.state === 'valid')
    return (
      <span className="key-badge valid" title={`Key valid — ${check.detail}`}>
        ✓
      </span>
    )
  return (
    <span className="key-badge invalid" title={check.detail}>
      ✕
    </span>
  )
}

/// Autosave feedback. Settings write themselves, so the footer's job is to
/// show that it happened — and, above all, to shout if a write FAILED, because
/// a silent failure means the user's API keys are not on disk.
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

/// An API key field you can just click into and type, that still never puts
/// key material on screen.
///
/// Unfocused it shows the backend's mask (head 6 + bullets + tail 6) — enough
/// to tell WHICH key is stored, useless to a shoulder or a screenshot. Sending
/// that mask back unchanged is how `save_settings` knows to keep the stored
/// key, so the value passes through verbatim.
///
/// Focused it becomes a `type="password"` box with the text pre-selected, so
/// typing or pasting replaces the key outright and the new key is not readable
/// either. There is no button to press first: clicking the box is the gesture.
function SecretField({
  label,
  value,
  placeholder,
  onChange,
  onEditingChange,
  check,
}: {
  label: string
  value: string
  placeholder: string
  onChange: (v: string) => void
  /// Held true while focused, so autosave waits for blur rather than
  /// persisting a half-typed key over a good one.
  onEditingChange: (editing: boolean) => void
  check: KeyCheck
}) {
  const [focused, setFocused] = useState(false)

  return (
    <div className="form-row">
      <label>{label}</label>
      <div className="key-row">
        <input
          className="key-input"
          // Password while focused so nothing readable is ever rendered; the
          // masked text only appears at rest, where it is not editable content.
          type={focused ? 'password' : 'text'}
          value={focused ? value : displaySecret(value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          aria-label={label}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => {
            setFocused(true)
            onEditingChange(true)
            // Select-all so the first keystroke or paste replaces the key
            // instead of appending to the mask.
            e.target.select()
          }}
          onBlur={() => {
            setFocused(false)
            onEditingChange(false)
          }}
        />
        <KeyBadge check={check} />
      </div>
    </div>
  )
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
  {
    id: 'keys',
    labelKey: 'settings.section.keys',
    icon: '🔑',
    descKey: 'settings.desc.keys',
  },
  {
    id: 'models',
    labelKey: 'settings.section.models',
    icon: '🧠',
    descKey: 'settings.desc.models',
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
]

const SECTION_LABEL_KEY: Record<SectionId, string> = Object.fromEntries(
  SECTIONS.map((s) => [s.id, s.labelKey])
) as Record<SectionId, string>

interface RowDef {
  section: SectionId
  label: string
  kw: string
  node: ReactNode
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
  onClose,
  onSettingsChanged,
}: {
  onClose: () => void
  /// Called after every successful autosave so the rest of the app can pick
  /// the new settings up. It does NOT mean "the user is finished" — this fires
  /// mid-edit, so nothing hung off it may close the modal.
  onSettingsChanged: (s: Settings) => void
}) {
  const [settings, setSettings] = useState<Settings | null>(null)
  // The last state known to be on disk. Autosave fires whenever `settings`
  // drifts from this, and this catches up once the write lands.
  const [persisted, setPersisted] = useState<Settings | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  // True while an API key box has focus. Autosave holds off until blur so a
  // half-typed key is never written over a good stored one.
  const [editingSecret, setEditingSecret] = useState(false)
  const [mics, setMics] = useState<MediaDeviceInfo[]>([])
  const [openrouterCheck, setOpenrouterCheck] = useState<KeyCheck>({ state: 'idle', detail: '' })
  const [groqCheck, setGroqCheck] = useState<KeyCheck>({ state: 'idle', detail: '' })
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
        logInfo('[settings] loaded', {
          target: s.target_language,
          native: s.native_language,
          model: s.openrouter_model,
          openrouterKey: s.openrouter_key ? 'set' : 'MISSING',
          groqKey: s.groq_key ? 'set' : 'MISSING',
        })
      })
      .catch((e) => {
        reportFault('Loading settings', e)
        setSettings(null)
      })
  }, [])

  const listMics = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())
      const devices = await navigator.mediaDevices.enumerateDevices()
      setMics(devices.filter((d) => d.kind === 'audioinput'))
    } catch (e) {
      reportFault('Listing microphones', e)
    }
  }, [])

  // Mic enumeration only when the Audio section is visited, so opening
  // Settings does not trip the mic-permission prompt as a side effect.
  useEffect(() => {
    if (section === 'voice') void listMics()
  }, [section, listMics])

  // Validate both keys as they change (debounced) — including on first load.
  useEffect(() => {
    const key = settings?.openrouter_key
    if (key === undefined) return
    if (!key.trim()) {
      setOpenrouterCheck({ state: 'idle', detail: '' })
      return
    }
    setOpenrouterCheck({ state: 'checking', detail: '' })
    const t = setTimeout(() => {
      void validateKey('openrouter', key)
        .then((s) =>
          setOpenrouterCheck({ state: s.valid ? 'valid' : 'invalid', detail: s.detail })
        )
        .catch((e) => setOpenrouterCheck({ state: 'invalid', detail: String(e) }))
    }, 600)
    return () => clearTimeout(t)
  }, [settings?.openrouter_key])

  useEffect(() => {
    const key = settings?.groq_key
    if (key === undefined) return
    if (!key.trim()) {
      setGroqCheck({ state: 'idle', detail: '' })
      return
    }
    setGroqCheck({ state: 'checking', detail: '' })
    const t = setTimeout(() => {
      void validateKey('groq', key)
        .then((s) => setGroqCheck({ state: s.valid ? 'valid' : 'invalid', detail: s.detail }))
        .catch((e) => setGroqCheck({ state: 'invalid', detail: String(e) }))
    }, 600)
    return () => clearTimeout(t)
  }, [settings?.groq_key])

  // ── Autosave ────────────────────────────────────────────────────────────
  // There is no Save button. Every edit is written after a short pause, so a
  // key typed into the box is on disk whether or not the modal is dismissed.
  const dirty = !!settings && !!persisted && JSON.stringify(settings) !== JSON.stringify(persisted)

  useEffect(() => {
    if (!settings || !dirty) return
    // Wait for the key box to lose focus — writing mid-keystroke would put a
    // truncated key on disk and clobber the working one.
    if (editingSecret) return
    setSaveState('pending')
    const timer = setTimeout(() => {
      setSaveState('saving')
      logInfo('[settings] autosaving', {
        target: settings.target_language,
        native: settings.native_language,
        model: settings.openrouter_model,
      })
      saveSettings(settings)
        .then(() => {
          logInfo('[settings] autosaved ✓')
          setPersisted(settings)
          setSaveState('saved')
          onSettingsChanged(settings)
        })
        .catch((e) => {
          // A failed write means the keys are NOT on disk. The footer says so
          // inline, and the fault bus puts it at the top of the app as well.
          reportFault('Saving settings', e)
          setSaveState('error')
        })
    }, AUTOSAVE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [settings, dirty, editingSecret, onSettingsChanged])

  // Escape closes. Safe now that everything autosaves — and with backdrop
  // click-to-dismiss gone, this is the only keyboard way out.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // ShortcutField binds Escape to "reset this shortcut to its default";
      // while it is recording, Escape belongs to it, not to the modal.
      const active = document.activeElement as HTMLElement | null
      if (active?.hasAttribute('data-shortcut-capture')) return
      onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Closing the modal inside the debounce window must not drop the pending
  // edit: an unwritten API key is a lost one. Flush it on unmount.
  const pendingWrite = useRef<Settings | null>(null)
  useEffect(() => {
    pendingWrite.current = dirty || editingSecret ? settings : null
  }, [settings, dirty, editingSecret])
  useEffect(
    () => () => {
      const outstanding = pendingWrite.current
      if (!outstanding) return
      logInfo('[settings] flushing a pending edit on close')
      void saveSettings(outstanding).catch((e) => reportFault('Saving settings', e))
    },
    []
  )

  // Let "Saved" fade back to nothing so the footer is not permanently shouting.
  useEffect(() => {
    if (saveState !== 'saved') return
    const t = setTimeout(() => setSaveState('idle'), 1800)
    return () => clearTimeout(t)
  }, [saveState])

  const resetAll = useCallback(async () => {
    if (
      !window.confirm(
        'Reset every setting to its default?\n\nThis also clears both API keys — you will need to paste them in again.'
      )
    )
      return
    try {
      logInfo('[settings] resetting all settings to defaults')
      const fresh = await resetSettings()
      setSettings(fresh)
      setPersisted(fresh)
      setSaveState('saved')
      onSettingsChanged(fresh)
    } catch (e) {
      reportFault('Resetting settings', e)
      setSaveState('error')
    }
  }, [onSettingsChanged])

  if (!settings) {
    return (
      <div className="modal-backdrop">
        <div className="settings-modal">
          <p className="center-note">Loading…</p>
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
    openrouter_key: {
      section: 'keys',
      label: L('openrouter_key', 'OpenRouter API key'),
      kw: 'openrouter api key credential token chat tutor',
      node: (
        <SecretField
          label="OpenRouter API key"
          value={settings.openrouter_key}
          placeholder="sk-or-…"
          check={openrouterCheck}
          onChange={(v) => setSettings({ ...settings, openrouter_key: v })}
          onEditingChange={setEditingSecret}
        />
      ),
    },
    groq_key: {
      section: 'keys',
      label: L('groq_key', 'Groq API key (speech-to-text)'),
      kw: 'groq api key credential speech transcription stt whisper voice',
      node: (
        <SecretField
          label="Groq API key (speech-to-text)"
          value={settings.groq_key}
          placeholder="gsk_…"
          check={groqCheck}
          onChange={(v) => setSettings({ ...settings, groq_key: v })}
          onEditingChange={setEditingSecret}
        />
      ),
    },
    worker_model: {
      section: 'models',
      label: L('worker_model', 'Worker model (tutor · analysis · coach)'),
      kw: 'worker model llm gemini openai deepseek tutor analysis speed',
      node: (
        <div className="form-row">
          <label>Worker model</label>
          <input
            value={settings.openrouter_model}
            onChange={(e) => setSettings({ ...settings, openrouter_model: e.target.value })}
          />
        </div>
      ),
    },
    observer_model: {
      section: 'models',
      label: L('observer_model', 'Observer model (reasoning · planning)'),
      kw: 'observer model reasoning planning coach agent',
      node: (
        <div className="form-row">
          <label>Observer model</label>
          <input
            value={settings.observer_model ?? ''}
            placeholder="(same as worker model)"
            onChange={(e) =>
              setSettings({ ...settings, observer_model: e.target.value || null })
            }
          />
        </div>
      ),
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
              {mics.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Microphone ${i + 1}`}
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
      label: L('tts_voice', 'Cloud voice'),
      kw: 'cloud voice actor narrator openai alloy nova',
      node: (
        <div className="form-row">
          <label>Cloud voice</label>
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
            <span>Auto-speak tutor replies (OS voice, free &amp; offline)</span>
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
            <span>Auto-send transcriptions (mic → send immediately)</span>
          </label>
        </div>
      ),
    },
    always_romanize: {
      section: 'voice',
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
            <span>Always show romanization (non-Latin targets like Arabic)</span>
          </label>
        </div>
      ),
    },
    auto_translate: {
      section: 'voice',
      label: L('auto_translate', 'Always show translation'),
      kw: 'translation always show native meaning under reply',
      node: (
        <div className="form-row check-row">
          <label className="check-label">
            <input
              type="checkbox"
              checked={settings.auto_translate}
              onChange={(e) => setSettings({ ...settings, auto_translate: e.target.checked })}
            />
            <span>Always show the translation under each reply</span>
          </label>
        </div>
      ),
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

  const q = search.trim().toLowerCase()
  const searching = q.length > 0
  const allRows = Object.entries(rows)
  // On mobile every section is shown at once, in one vertical scroll with
  // headings. The section nav became a cramped horizontal strip on a phone —
  // scrolling past headings beats scrolling sideways to find a tab.
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
    // No click-to-dismiss on the backdrop: the click that refocuses the app
    // after copying a key from another window lands here, and must not throw
    // the open settings away. Closing is deliberate — Close, Escape, or back.
    <div className="modal-backdrop">
      <div
        className="settings-modal"
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
          />
          {!isMobile && (
            <nav className="settings-tree">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`nav-item ${!searching && section === s.id ? 'active' : ''}`}
                  onClick={() => {
                    setSearch('')
                    setSection(s.id)
                  }}
                >
                  <span className="nav-icon">{s.icon}</span>
                  {t(ui, s.labelKey)}
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
                  ? tOr(ui, 'settings.subtitle', 'All settings — scroll through.')
                  : t(ui, activeSection.descKey)}
            </p>
          </div>
          <div className="settings-scroll">
            {searching && visibleRows.length === 0 && (
              <p className="center-note">Nothing matches “{search.trim()}”.</p>
            )}
            {renderRows.map(({ id, row, heading }) => (
              <div key={id} className="settings-entry">
                {heading && (
                  <p className="settings-group-k">{t(ui, SECTION_LABEL_KEY[heading])}</p>
                )}
                {row.node}
              </div>
            ))}
            {!searching && visibleRows.length === 0 && (
              <p className="center-note">Nothing here yet.</p>
            )}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn danger" onClick={() => void resetAll()}>
              Reset all
            </button>
            <SaveStatus state={saveState} />
            <button type="button" className="btn" onClick={onClose}>
              Close
            </button>
          </div>
        </main>
      </div>
    </div>
  )
}
