import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '../../components/localization/i18n'
import { errorMessage, errorDetails } from '../../platform/diagnostics/error-details'
import { DetailDialog } from '../../components/dialogs/DetailDialog'
import { ResponseDetails } from '../../components/feedback/ResponseDetails'
import { ExplanationCards } from '../../components/reading/ExplanationCards'
import { useReadingLookup, type ReadingScope } from '../../components/reading/ReadingContext'
import type { DrillItemView, ReplyExplanations } from '../../generated/contracts'

/** The Analysis action on a practice phrase: the same grammar explanations Chat
 * asks for about a partner message, through the shared reading aid. The request
 * is bound to the phrase that asked for it — a late answer never lands on
 * another one. */
export function DrillAnalysis({ item, scope, nativeLanguageName, children }: {
  item: DrillItemView
  scope: ReadingScope
  nativeLanguageName: string
  children: (analysis: { pending: boolean; onOpen: () => void }) => ReactNode
}) {
  const tr = useI18n()
  const lookup = useReadingLookup()
  const [open, setOpen] = useState(false)
  const [cards, setCards] = useState<{ itemId: string; value: ReplyExplanations } | null>(null)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<unknown>(null)
  const request = useRef<AbortController | null>(null)
  // The phrase, or its language, changed: whatever was asked about the old one
  // is abandoned, and nothing it returns is shown here.
  const key = JSON.stringify([item.id, scope])
  useEffect(() => {
    request.current?.abort(); request.current = null
    setOpen(false); setCards(null); setPending(false); setFailure(null)
  }, [key])
  useEffect(() => () => request.current?.abort(), [])

  const ask = () => {
    setOpen(true)
    if (!lookup || pending || cards?.itemId === item.id) return
    const controller = new AbortController()
    request.current = controller
    setPending(true); setFailure(null)
    void lookup({ ...scope, text: item.text, aid: 'explanations' }, controller.signal)
      .then(result => {
        if (request.current !== controller) return
        if (result.explanations) setCards({ itemId: item.id, value: result.explanations })
      })
      .catch(error => { if (request.current === controller) setFailure(error) })
      .finally(() => { if (request.current === controller) setPending(false) })
  }

  return <>
    {children({ pending, onOpen: ask })}
    {open && <DetailDialog title={tr("Message analysis")} onClose={() => setOpen(false)}>
      <h2>{tr("Message analysis")}</h2>
      {pending && <p role="status">{tr("⟳ Analyzing grammar…")}</p>}
      {failure != null && <>
        <p role="alert">{errorMessage(failure)}</p>
        <ResponseDetails value={errorDetails(failure)} />
        <button type="button" className="btn" onClick={ask}>{tr("Try again")}</button>
      </>}
      {cards?.itemId === item.id && (cards.value.cards.length
        ? <ExplanationCards cards={cards.value.cards} nativeLanguageName={nativeLanguageName} />
        : <p>{tr("Nothing to flag in this reply.")}</p>)}
    </DetailDialog>}
  </>
}
