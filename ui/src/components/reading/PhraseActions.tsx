import { TokenAudio } from './TokenAudio'
import { AddToDrillButton } from './AddToDrillButton'
import { useReadingActions, useReadingScope } from './ReadingContext'
import { ToolbarIcon } from '../controls/ToolbarIcon'
import { useI18n } from '../localization/i18n'

/** Actions belong to the exact displayed phrase and its captured language. */
export function PhraseActions({ text, addToDrill = true }: { text: string; addToDrill?: boolean }) {
  const scope = useReadingScope()
  const actions = useReadingActions()
  const tr = useI18n()
  if (!scope || !text.trim()) return null
  return <span className="target-phrase-actions"><TokenAudio text={text} />
    {actions && <button type="button" className="token-audio" aria-label={tr('Reading help')} title={tr('Reading help')} aria-haspopup="dialog"
      onPointerDown={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}
      onClick={event => { event.stopPropagation(); actions.inspect({ text, start: 0, end: text.length, scope }) }}><ToolbarIcon name="reading" size={16} /></button>}
    {addToDrill && <AddToDrillButton text={text} />}</span>
}
