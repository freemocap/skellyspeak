import { useId, type ReactNode } from 'react'
import { useI18n } from '../../components/localization/i18n'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import type { DrillItemView } from '../../generated/contracts'

/** Select or delete existing phrases. With none, the rail is one large Add
 * practice cards button; creation belongs to the full Add phrases dialog. */
export function PhraseRail({ items, selectedId, busy, locked, onSelect, onDelete, onAddPhrases, children }: {
  items: DrillItemView[]
  selectedId: string | null
  busy: boolean
  locked: boolean
  onSelect: (id: string) => void
  onDelete: (item: DrillItemView) => Promise<void>
  onAddPhrases: () => void
  children: ReactNode
}) {
  const tr = useI18n()
  const emptyNote = useId()
  return (
    <aside className="drill-rail" aria-label={tr("Your practice cards")}>
      {items.length === 0
        ? <button type="button" className="drill-rail-add" aria-haspopup="dialog" aria-label={tr("Add practice cards…")}
          aria-describedby={emptyNote} disabled={locked} onClick={onAddPhrases}>
          <span className="drill-rail-add-mark"><ToolbarIcon name="deck-add" size={30} /></span>
          <span className="drill-rail-add-label">{tr("Add practice cards…")}</span>
          <span className="drill-rail-add-note" id={emptyNote}>{tr("No practice cards yet")}</span>
        </button>
        : <ul className="drill-items" aria-label={tr("Practice cards")}>
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
