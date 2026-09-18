import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../../components/localization/i18n'
import { ToolbarIcon } from '../../../components/controls/ToolbarIcon'
import { useIsMobile } from '../../../components/layout/useIsMobile'
import type { Settings } from '../../../types'

type QuickSetting = 'auto_speak' | 'auto_send' | 'auto_translate' | 'always_romanize' | 'always_pronunciation' | 'fast_mode'
type Toggle = [QuickSetting, string, string]

/// The conversation's own settings: one labelled button in the chat header opens
/// every control that changes this conversation. A phone gets a bottom sheet over
/// a scrim; a desktop window gets a panel on the inline end that leaves the chat
/// readable beside it. Both render into the body so no clipping or stacking
/// context of the chat header can hide them.
///
/// The toggles are the same Settings record the Settings modal edits — Rust owns
/// it, and these are a second VIEW of one variable, not a copy.
export function ConversationSettings({ summary, open, onOpenChange, settings, saving, onToggle, nativePicker, difficulty, promptControls, showRomanization, exportDisabled, onExport }: {
  /// The current settings in a few words ("Beginner · Reading aloud"), shown on
  /// the button that changes them.
  summary?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: Settings | null
  saving: boolean
  onToggle: (key: QuickSetting | 'tts_rate', value?: number) => Promise<void>
  nativePicker: ReactNode
  promptControls?: ReactNode
  difficulty: ReactNode
  showRomanization: boolean
  exportDisabled: boolean
  onExport: () => void
}) {
  const tr = useI18n()
  const isMobile = useIsMobile()
  const toggleButton = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef(() => onOpenChange(false))
  close.current = () => onOpenChange(false)

  useEffect(() => {
    if (!open) return
    panel.current?.focus()
    const dismiss = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (target instanceof Element && target.closest('[role="dialog"]:not(.conversation-settings)')) return
      if (panel.current?.contains(target) || toggleButton.current?.contains(target)) return
      close.current()
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('[role="dialog"]:not(.conversation-settings)')) return
      close.current()
      toggleButton.current?.focus()
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  const groups: [string, Toggle[]][] = [
    ['Reading help', [
      ...(showRomanization ? [['always_romanize', 'Romanization', 'Always show romanization under each word'] as Toggle] : []),
      ['auto_translate', 'Translation', 'Always show the translation under each reply'],
      ['always_pronunciation', 'Pronunciation', 'Show saved pronunciation in replies and coach advice'],
    ]],
    ['Speech', [
      ['auto_speak', 'Read aloud', 'Speak each reply automatically'],
      ['auto_send', 'Auto-send', 'Send speech transcriptions immediately'],
    ]],
    ['Rewards', [
      ['fast_mode', 'Fast mode', 'Automatically dismiss new XP cards; point icons reopen them'],
    ]],
  ]

  const sheet = open && createPortal(<>
    {isMobile && <div className="conversation-settings-scrim" aria-hidden="true" />}
    <div ref={panel} id="chat-settings" tabIndex={-1} role="dialog" aria-modal={isMobile} aria-labelledby="chat-settings-title"
      className={`conversation-settings ${isMobile ? 'conversation-settings-sheet' : 'conversation-settings-panel'}`}>
      <div className="conversation-settings-head">
        <h2 id="chat-settings-title">{tr("Conversation settings")}</h2>
        <button type="button" className="conversation-settings-close" aria-label={tr("Close")} title={tr("Close")} onClick={() => { close.current(); toggleButton.current?.focus() }}>
          <ToolbarIcon name="close" size={16} />
        </button>
      </div>
      <div className="conversation-settings-body">
        <section className="conversation-settings-group" aria-label={tr("Languages")}>
          <h3>{tr("Languages")}</h3>
          <div className="conversation-settings-field">{nativePicker}</div>
          {difficulty && <label className="conversation-settings-field"><span>{tr("Difficulty")}</span>{difficulty}</label>}
        </section>
        {promptControls}
        {groups.map(([heading, toggles]) => <section key={heading} className="conversation-settings-group" aria-label={tr(heading)}>
          <h3>{tr(heading)}</h3>
          {toggles.map(([key, label, description]) => <label key={key} className="conversation-setting">
            <span><strong>{tr(label)}</strong><small>{tr(description)}</small></span>
            <input type="checkbox" role="switch" checked={settings?.[key] ?? false} disabled={!settings || saving}
              onChange={() => void onToggle(key)} />
          </label>)}
          {heading === 'Speech' && <label className="conversation-settings-field">
            <span>{tr("Voice speed")}</span>
            <select className="chat-language-picker" aria-label={tr("Voice playback speed")} value={settings?.tts_rate ?? 1} disabled={!settings || saving}
              onChange={event => void onToggle('tts_rate', Number(event.target.value))}>
              {[0.5, 0.65, 0.8, 1, 1.25, 1.5].map(rate => <option key={rate} value={rate}>{rate}×</option>)}
            </select>
          </label>}
        </section>)}
        <button type="button" className="conversation-settings-export" disabled={exportDisabled} onClick={() => { close.current(); onExport() }}>
          <ToolbarIcon name="update" size={15} />{tr("Conversation YAML")}
        </button>
      </div>
    </div>
  </>, document.body)

  return <>
    <button ref={toggleButton} type="button" className="chat-config-toggle" aria-expanded={open} aria-controls="chat-settings"
      aria-label={summary ? `${tr("Conversation settings")}: ${summary}` : tr("Conversation settings")} title={open ? tr("Hide chat settings") : tr("Show chat settings")}
      onClick={() => onOpenChange(!open)}>
      <ToolbarIcon name="settings" size={17} />
      <span className="chat-config-text"><span className="chat-config-label">{tr("Conversation settings")}</span>{summary && <small className="chat-config-summary">{summary}</small>}</span>
    </button>
    {sheet}
  </>
}
