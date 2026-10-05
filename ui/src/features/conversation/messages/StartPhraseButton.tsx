import { useEffect, useRef, useState } from 'react'
import { GitFork } from 'lucide-react'
import { useI18n } from '../../../components/localization/i18n'
import { ErrorNotice } from '../../../components/feedback/ErrorNotice'
import { nativeError } from '../../../platform/ipc/workspace'
import { wholeWordSelection } from '../../../components/reading/whole-word-selection'

/** Capture selection before the button takes focus. The native owner verifies it. */
export function StartPhraseButton({ messageId, text, onStart }: {
  messageId: string; text: string; onStart: (messageId: string, phrase: string) => Promise<void>
}) {
  const tr = useI18n()
  const selected = useRef<string | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const pending = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const capture = () => {
    const source = button.current?.closest('.msg')?.querySelector('[data-phrase-source]')
    return source ? wholeWordSelection(source, text, window.getSelection()) : null
  }
  useEffect(() => {
    const expand = () => { capture() }
    document.addEventListener('pointerup', expand)
    document.addEventListener('keyup', expand)
    return () => { document.removeEventListener('pointerup', expand); document.removeEventListener('keyup', expand) }
  }, [text])
  return <>
    <button ref={button} type="button" className="message-tools-icon" disabled={busy} title={tr('Start conversation from this message')} aria-label={tr('Start conversation from this message')}
      onPointerDown={() => { selected.current = capture() }}
      onClick={async event => {
        event.stopPropagation()
        if (pending.current) return
        pending.current = true; setBusy(true); setError(null)
        const phrase = selected.current ?? capture() ?? text
        selected.current = null
        try { await onStart(messageId, phrase) } catch (reason) { setError(reason) }
        finally { pending.current = false; setBusy(false) }
      }}><GitFork size={16} aria-hidden="true" /></button>
    {error != null && <ErrorNotice error={error}>{nativeError(error)}</ErrorNotice>}
  </>
}
