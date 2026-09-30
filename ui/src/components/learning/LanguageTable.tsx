import { useState } from 'react'
import { ToolbarIcon, type ToolbarIconName } from '../controls/ToolbarIcon'
import { effortDimensions } from './effort-dimensions'
import type { LanguageTotals } from '../../generated/contracts'
import { useI18n } from '../localization/i18n'

type Column = 'language' | 'xp' | 'conversations' | 'partnerUnderstood' | 'noIssuesFlagged' | 'revisionsSent' | 'practiceAttempts'

/** The language's short code: the primary subtag of its declared language tag. */
export function languageCode(row: Pick<LanguageTotals, 'languageTag' | 'target'>) {
  return (row.languageTag ?? row.target).split('-')[0].toUpperCase()
}

/** Every language's totals side by side, sortable by any column. `compact` names
 * the unit columns by icon only and leaves out conversations. */
export function LanguageTable({ rows, active, compact = false, onSelect }: {
  rows: LanguageTotals[]; active?: string; compact?: boolean; onSelect?: (target: string) => void
}) {
  const tr = useI18n()
  const [sort, setSort] = useState<{ column: Column; descending: boolean }>({ column: 'xp', descending: true })
  const columns: { id: Column; label: string; icon?: ToolbarIconName }[] = [
    { id: 'xp', label: 'XP', icon: 'star' },
    ...(compact ? [] : [{ id: 'conversations' as const, label: 'Conversations', icon: 'chat' as const }]),
    ...effortDimensions.map(({ field, label, icon }) => ({ id: field, label, icon })),
  ]
  const value = (row: LanguageTotals, column: Column) => column === 'language' ? row.name : row[column]
  const sorted = [...rows].sort((a, b) => {
    const left = value(a, sort.column)
    const right = value(b, sort.column)
    const order = typeof left === 'string' ? left.localeCompare(String(right), tr.browserLocale) : left - Number(right)
    return (sort.descending ? -order : order) || b.xp - a.xp || a.name.localeCompare(b.name, tr.browserLocale)
  })
  const header = (id: Column, label: string, icon?: ToolbarIconName) => {
    const current = sort.column === id
    return <th key={id} scope="col" data-column={id} data-unit={unitColumn(id)} aria-sort={current ? (sort.descending ? 'descending' : 'ascending') : 'none'}>
      <button type="button" title={tr(label)} aria-label={tr(label)} onClick={() => setSort({ column: id, descending: current ? !sort.descending : id !== 'language' })}>
        {icon && <ToolbarIcon name={icon} size={14} />}{(!compact || !icon) && <span>{tr(label)}</span>}
        {/* Every header reserves the arrow's space, so sorting never changes a column's width. */}
        <span className="language-table-sort" data-shown={current || undefined} aria-hidden="true">{current && !sort.descending ? '▴' : '▾'}</span>
      </button>
    </th>
  }
  return <table className="language-table" data-compact={compact || undefined}>
    <thead><tr>{header('language', 'Languages')}{columns.map(column => header(column.id, column.label, column.icon))}</tr></thead>
    <tbody>{sorted.map(row => <tr key={row.target} data-active={row.target === active || undefined}>
      <th scope="row">
        {onSelect ? <button type="button" className="language-table-name" onClick={() => onSelect(row.target)}><Name row={row} /></button> : <span className="language-table-name"><Name row={row} /></span>}
      </th>
      {columns.map(column => <td key={column.id} data-column={column.id} data-unit={unitColumn(column.id)}>{tr.number(row[column.id as Exclude<Column, 'language'>])}</td>)}
    </tr>)}</tbody>
  </table>
}

/** Effort columns carry their unit so they take its colour. */
function unitColumn(id: Column) {
  return effortDimensions.some(({ field }) => field === id) ? id : undefined
}

function Name({ row }: { row: LanguageTotals }) {
  return <><span className="language-code" aria-hidden="true">{languageCode(row)}</span><span>{row.name}</span></>
}
