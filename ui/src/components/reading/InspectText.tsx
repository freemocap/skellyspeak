import { useReadingActions, useReadingScope } from './ReadingContext'
import { useI18n } from '../localization/i18n'
import { ToolbarIcon } from '../controls/ToolbarIcon'

/** Companion to text inside an action or editor; never nests interactive tokens. */
export function InspectText({ text, start = 0, end = text.length, language, variety }: { text: string; start?: number; end?: number; language?: string; variety?: string | null }) {
  const tr = useI18n()
  const actions = useReadingActions(); const scope = useReadingScope()
  if (!actions || !scope || !text.trim()) return null
  return <button type="button" className="token-audio" aria-label={tr('Inspect text: {text}', { text: text.slice(start, end) })} title={tr('Word help')}
    onClick={event => { event.stopPropagation(); actions.inspect({ text, start, end, scope: { ...scope, language: language ?? scope.language, variety: variety ?? (language && language !== scope.language ? null : scope.variety) } }) }}>
    <ToolbarIcon name="reading" size={16} />
  </button>
}
