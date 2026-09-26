import { useRef, useState } from 'react'
import { useReadingScope } from './ReadingContext'
import { useI18n } from '../localization/i18n'
import { ErrorDetails } from '../feedback/ErrorDetails'
import { ResponseDetails } from '../feedback/ResponseDetails'
import { errorMessage } from '../../platform/diagnostics/error-details'
import { createDrillItem, deleteDrillItem } from '../../platform/ipc/drill'
import { ToolbarIcon } from '../controls/ToolbarIcon'

type DrillLink = { kind: 'ready' } | { kind: 'saving' } | { kind: 'saved'; itemId: string } | { kind: 'removing'; itemId: string }

/** Copy a completed message through the same command as Drill's manual entry,
 * and remove that Drill item on a second press. The reading scope belongs to
 * this conversation, not current global preferences. */
export function AddToDrillButton({ text }: { text: string }) {
  const scope = useReadingScope()
  return <ScopedAddToDrill key={JSON.stringify([scope, text])} text={text} />
}

function ScopedAddToDrill({ text }: { text: string }) {
  const scope = useReadingScope()
  const tr = useI18n()
  const busy = useRef(false)
  const [link, setLink] = useState<DrillLink>({ kind: 'ready' })
  const [failure, setFailure] = useState<{ action: 'add' | 'remove'; error: unknown } | null>(null)
  if (!scope || !text.trim()) return null
  const saved = link.kind === 'saved' || link.kind === 'removing'
  const label = saved ? tr('Remove from Drill') : tr('Add to Drill')
  async function toggle() {
    if (!scope || busy.current) return
    busy.current = true
    setFailure(null)
    try {
      if (link.kind === 'ready') {
        setLink({ kind: 'saving' })
        try {
          const item = await createDrillItem({ text, ...scope })
          setLink({ kind: 'saved', itemId: item.id })
        } catch (error) {
          setFailure({ action: 'add', error }); setLink({ kind: 'ready' })
        }
      } else if (link.kind === 'saved') {
        const itemId = link.itemId
        setLink({ kind: 'removing', itemId })
        try {
          await deleteDrillItem(itemId)
          setLink({ kind: 'ready' })
        } catch (error) {
          setFailure({ action: 'remove', error }); setLink({ kind: 'saved', itemId })
        }
      }
    } finally { busy.current = false }
  }
  return <>
    <button type="button" className="message-translate message-add-drill" title={label} aria-label={label}
      aria-busy={link.kind === 'saving' || link.kind === 'removing'} data-state={saved ? 'saved' : 'ready'}
      disabled={link.kind === 'saving' || link.kind === 'removing'}
      onClick={event => { event.stopPropagation(); void toggle() }}>
      <ToolbarIcon name={saved ? 'deck-added' : 'deck-add'} size={20} />
    </button>
    {failure != null && <ErrorDetails label={failure.action === 'add' ? tr('Add to Drill') : tr('Remove from Drill')} errorKey={errorMessage(failure.error)} explanation={errorMessage(failure.error)}>
      <ResponseDetails value={failure.error} />
    </ErrorDetails>}
  </>
}
