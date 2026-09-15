import { useRef, useState } from 'react'
import type { ReplyState } from '../../domain/language/reply-state'
import { nativeError } from '../../platform/ipc/workspace'
import { ActivityIndicator } from '../../ui/ActivityIndicator'
import { useI18n } from '../../ui/i18n'

export function ReplyStatus({ reply, onControl, onActivity }: { reply?: ReplyState; onControl?: (control: 'retry' | 'resume') => Promise<void>; onActivity?: () => void }) {
  const tr = useI18n()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const locked = useRef(false)
  const state = reply?.state ?? 'unavailable'
  if (state === 'pending') return <div className="msg bot pending"><ActivityIndicator compact label={tr('Thinking…')} /></div>
  const label = state === 'failed' ? tr('Partner reply failed.') : state === 'unknown' ? tr('Partner reply outcome is unknown. Retrying may repeat provider work and charges.') : state === 'cancelled' ? tr('Partner reply was cancelled. Send a new message to continue.') : state === 'held' ? tr('Partner reply is held.') : state === 'paused' ? tr('Partner reply is paused.') : tr('Partner reply is unavailable.')
  return <div className="msg bot">
    <p role={state === 'failed' || state === 'unknown' || state === 'unavailable' ? 'alert' : 'status'}>{label}</p>
    {reply?.error && <p>{reply.error}</p>}
    {reply?.control && onControl && <button type="button" disabled={pending} onClick={() => {
      if (locked.current) return
      locked.current = true; setPending(true); setError(null)
      void onControl(reply.control!).catch(reason => setError(nativeError(reason))).finally(() => { locked.current = false; setPending(false) })
    }}>{reply.control === 'retry' ? tr('Retry exchange') : tr('Resume exchange')}</button>}
    {onActivity && <button type="button" onClick={onActivity}>{tr('Open AI activity')}</button>}
    {error && <p role="alert">{error}</p>}
  </div>
}
