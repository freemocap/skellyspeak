import { createContext, useContext } from 'react'
import { useI18n } from '../localization/i18n'

/** The conversation supplies routing; shared reading controls do not own coach state. */
export const AskCoachContext = createContext<((question: string) => void) | null>(null)

export function AskCoachButton({ question, onClose, compact = false }: { question: string; onClose?: () => void; compact?: boolean }) {
  const ask = useContext(AskCoachContext)
  const tr = useI18n()
  if (!ask) return null
  return <button type="button" className={compact ? "token-coach" : "detail-action"} aria-label={tr("Ask the coach")} title={tr("Ask the coach")} onClick={event => {
    event.stopPropagation()
    onClose?.()
    ask(question)
  }}>{compact ? <span aria-hidden="true">?</span> : tr("Ask the coach")}</button>
}
