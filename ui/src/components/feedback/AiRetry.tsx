import { createContext, useRef, useState } from 'react'
import { useI18n } from '../localization/i18n'
import { errorMessage } from '../../platform/diagnostics/error-details'

export type RetryAction = () => Promise<void> | void
export const AiRetryContext = createContext<RetryAction | null>(null)

/** Owners provide the retry operation; presentation never guesses what to resend. */
export function AiRetry({ run }: { run: RetryAction }) {
  const tr = useI18n()
  const locked = useRef(false)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<unknown>(null)
  return <>
    <button type="button" className="btn" disabled={pending} onClick={event => {
      event.preventDefault(); event.stopPropagation()
      if (locked.current) return
      locked.current = true; setPending(true); setFailure(null)
      void Promise.resolve().then(run).catch(setFailure).finally(() => { locked.current = false; setPending(false) })
    }}>{tr('Retry')}</button>
    {failure != null && <span role="alert">{errorMessage(failure)}</span>}
  </>
}
