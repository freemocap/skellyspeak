import { useRef, useState } from 'react'
import { requestMessageHelp } from '../../../platform/ipc/message-help'
import { nativeError } from '../../../platform/ipc/workspace'
import { ErrorNotice } from '../../../components/feedback/ErrorNotice'
import { useI18n } from '../../../components/localization/i18n'

type Aid = 'translation' | 'word_gloss'
/** Commands only follow deliberate reading actions; saved/pending work is reused. */
export function useDeferredReading(messageId: string | undefined, translationState?: string | null, glossState?: string | null) {
  const tr = useI18n()
  const states = { translation: translationState, word_gloss: glossState }
  const pending = useRef(new Set<Aid>())
  const [errors, setErrors] = useState<Partial<Record<Aid, unknown>>>({})
  async function send(aid: Aid, retry = false) {
    if (!messageId || pending.current.has(aid)) return
    pending.current.add(aid); setErrors(current => ({ ...current, [aid]: null }))
    try { await requestMessageHelp(messageId, aid, retry) }
    catch (error) { setErrors(current => ({ ...current, [aid]: error })) }
    finally { pending.current.delete(aid) }
  }
  return {
    request: async (aid: Aid) => { if (!states[aid] && errors[aid] == null) await send(aid) },
    status: <>
      {(['translation', 'word_gloss'] as const).map(aid => errors[aid] != null && <ErrorNotice key={aid} error={errors[aid]}
        onRetry={() => send(aid, ['failed', 'unknown'].includes(states[aid] ?? ''))}>{nativeError(errors[aid])}</ErrorNotice>)}
      {messageId && ['failed', 'unknown'].includes(translationState ?? '') && <button className="btn" type="button" onClick={() => void send('translation', true)}>{tr('Retry translation')}</button>}
    </>,
  }
}
