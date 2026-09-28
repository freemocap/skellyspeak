import { useI18n } from '../localization/i18n'
import { ToolbarIcon } from '../controls/ToolbarIcon'
import { useReadAloud } from './useReadAloud'

export function TokenAudio({ text, start = 0, end = text.length }: { text: string; start?: number; end?: number }) {
  const tr = useI18n()
  const readAloud = useReadAloud(text, start, end)
  if (!readAloud) return null
  return <button type="button" className="token-audio" aria-label={readAloud.playing ? tr('Stop reading') : tr('Read aloud: {text}', { text: text.slice(start, end) })}
    title={readAloud.playing ? tr('Stop reading') : tr('Read aloud')} aria-pressed={readAloud.playing}
    onPointerDown={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}
    onClick={event => { event.stopPropagation(); readAloud.onToggle() }}>
    <ToolbarIcon name={readAloud.playing ? 'close' : 'voice'} size={16} />
  </button>
}
