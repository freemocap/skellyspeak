import { useRef, useState } from 'react'
import { useReadingScope } from '../../../components/reading/ReadingContext'
import { useI18n } from '../../../components/localization/i18n'
import { ErrorDetails } from '../../../components/feedback/ErrorDetails'
import { ResponseDetails } from '../../../components/feedback/ResponseDetails'
import { errorMessage } from '../../../platform/diagnostics/error-details'
import { createDrillItem } from '../../../platform/ipc/drill'
import { ToolbarIcon } from '../../../components/controls/ToolbarIcon'

/** Copy a completed message through the same command as Drill's manual entry.
 * The reading scope belongs to this conversation, not current global preferences. */
export function AddToDrillButton({ text }: { text: string }) {
  const scope = useReadingScope()
  const tr = useI18n()
  const busy = useRef(false)
  const [state, setState] = useState<'ready' | 'saving' | 'saved'>('ready')
  const [failure, setFailure] = useState<unknown>(null)
  if (!scope || !text.trim()) return null
  const label = state === 'saved' ? tr('Added to Drill') : tr('Add to Drill')
  async function add() {
    if (!scope || busy.current || state === 'saved') return
    busy.current = true
    setState('saving'); setFailure(null)
    try {
      await createDrillItem({ text, ...scope })
      setState('saved')
    } catch (error) {
      setFailure(error); setState('ready')
    } finally { busy.current = false }
  }
  return <>
    <button type="button" className="message-translate message-add-drill" title={label} aria-label={label}
      aria-busy={state === 'saving'} data-state={state} disabled={state !== 'ready'}
      onClick={event => { event.stopPropagation(); void add() }}>
      <ToolbarIcon name={state === 'saved' ? 'deck-added' : 'deck-add'} size={20} />
    </button>
    {failure != null && <ErrorDetails label={tr('Add to Drill')} errorKey={errorMessage(failure)} explanation={errorMessage(failure)}>
      <ResponseDetails value={failure} />
    </ErrorDetails>}
  </>
}
