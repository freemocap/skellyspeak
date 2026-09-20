import { useI18n } from '../localization/i18n'
import { ToolbarIcon } from '../controls/ToolbarIcon'
import { speechKey, useReadingActions, useReadingScope } from './ReadingContext'

export function TokenAudio({ text, start = 0, end = text.length }: { text: string; start?: number; end?: number }) {
  const tr = useI18n()
  const actions = useReadingActions()
  const scope = useReadingScope()
  if (!actions || !scope) return null
  const selection = { text, start, end, scope }
  const active = actions.speaking === speechKey(selection)
  return <button type="button" className="token-audio" aria-label={active ? tr('Stop reading') : tr('Read aloud: {text}', { text: text.slice(start, end) })}
    title={active ? tr('Stop reading') : tr('Read aloud')} aria-pressed={active}
    onPointerDown={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}
    onClick={event => { event.stopPropagation(); if (active) actions.stop(); else actions.speak(selection) }}>
    <ToolbarIcon name={active ? 'close' : 'voice'} size={16} />
  </button>
}
