import { useState, type ReactNode } from 'react'
import { useI18n } from '../../components/localization/i18n'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import type { DrillItemView } from '../../generated/contracts'

/** The learner's own phrases: add one, pick one, delete one.
 *
 * A phrase cannot be edited, so deleting is the only correction and the rail
 * says what deleting takes with it. */
export function PhraseRail({ items, selectedId, languageTag, busy, locked, onAdd, onSelect, onDelete, onAskForMore, children }: {
  items: DrillItemView[]
  selectedId: string | null
  languageTag: string | undefined
  busy: boolean
  locked: boolean
  onAdd: (text: string) => Promise<void>
  onSelect: (id: string) => void
  onDelete: (item: DrillItemView) => Promise<void>
  onAskForMore: () => void
  children: ReactNode
}) {
  const tr = useI18n()
  const [phrase, setPhrase] = useState('')
  const submit = async () => {
    if (!phrase.trim()) return
    await onAdd(phrase)
    setPhrase('')
  }

  return (
    <aside className="drill-rail" aria-label={tr("Your phrases")}>
      <form className="drill-entry" onSubmit={event => { event.preventDefault(); void submit() }}>
        <label htmlFor="drill-phrase">{tr("Practise a phrase")}</label>
        <div className="drill-entry-row">
          <input id="drill-phrase" className="field" dir="auto" lang={languageTag} value={phrase} disabled={busy}
            placeholder={tr("Type a line to say out loud")} onChange={event => setPhrase(event.target.value)} />
          <button className="btn" type="submit" disabled={busy || !phrase.trim()}>{tr("Add")}</button>
        </div>
      </form>
      <button type="button" className="btn drill-ask-more" disabled={busy || locked} onClick={onAskForMore}>
        {tr("Add phrases…")}
      </button>

      {items.length === 0
        ? <p className="drill-rail-empty">{tr("Nothing to practise yet. Type a line you want to be able to say, or ask for some.")}</p>
        : <ul className="drill-items" aria-label={tr("Phrases")}>
          {items.map(item => (
            <li key={item.id}>
              <button type="button" className="drill-item" aria-current={item.id === selectedId} disabled={locked}
                onClick={() => onSelect(item.id)}>
                <bdi className="drill-item-text">{item.text}</bdi>
                <span className="drill-item-meta">{meta(item, tr)}</span>
              </button>
              <button type="button" className="btn drill-remove" disabled={busy || locked} onClick={() => void onDelete(item)}
                aria-label={tr("Delete “{value0}” and its attempts", { value0: item.text })}>
                <ToolbarIcon name="trash" size={15} />
              </button>
            </li>
          ))}
        </ul>}

      <div className="drill-rail-foot">{children}</div>
    </aside>
  )
}

/// How many attempts, and the best measured match — both counted natively across
/// the whole history, not over whichever page happens to be loaded. When nothing
/// could be measured the count stands alone rather than implying a score.
function meta(item: DrillItemView, tr: ReturnType<typeof useI18n>) {
  if (item.attemptCount === 0) return tr("No attempts yet")
  const value0 = String(item.attemptCount)
  return item.bestMatchRatio === null
    ? tr("{value0} attempts", { value0 })
    : tr("{value0} attempts · best {value1}%", { value0, value1: String(Math.round(item.bestMatchRatio * 100)) })
}
