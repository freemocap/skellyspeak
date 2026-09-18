import { createContext, useContext } from 'react'
import { useI18n } from '../localization/i18n'

/** The conversation supplies routing; shared reading controls do not own coach state. */
export const AskCoachContext = createContext<((question: string) => void) | null>(null)

export function AskCoachButton({ question, onClose }: { question: string; onClose?: () => void }) {
  const ask = useContext(AskCoachContext)
  const tr = useI18n()
  if (!ask) return null
  return <button type="button" className="detail-action" onClick={event => {
    event.stopPropagation()
    onClose?.()
    ask(question)
  }}>{tr("Ask the coach")}</button>
}
