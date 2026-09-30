import { useEffect, useState } from 'react'
import type { EffortProgress, LanguageTotals } from '../../generated/contracts'
import { getLanguageTotals } from '../../platform/ipc/skill-evidence'
import { errorMessage } from '../../platform/diagnostics/error-details'

/** Per-language totals for the learner's languages, refreshed whenever the evidence
 * or effort revision changes. Only languages in `included` are kept, in
 * that set's membership; ordering is the table's job. */
export function useLanguageTotals(evidence: unknown, effort: unknown, included: readonly string[] | undefined) {
  const [state, setState] = useState<{ rows: LanguageTotals[] | null; error: string | null }>({ rows: null, error: null })
  useEffect(() => {
    let current = true
    void getLanguageTotals()
      .then(rows => { if (current) setState({ rows, error: null }) })
      .catch(error => { if (current) setState(previous => ({ rows: previous.rows, error: errorMessage(error) })) })
    return () => { current = false }
  }, [evidence, effort])
  const rows = state.rows && included ? state.rows.filter(row => included.includes(row.target)) : state.rows
  const sum = (field: 'partnerUnderstood' | 'noIssuesFlagged' | 'revisionsSent' | 'practiceAttempts' | 'explorations' | 'bot') =>
    state.rows!.reduce((total, row) => total + row[field], 0)
  const globalEffort: EffortProgress | null = state.rows ? {
    target: '', recent: [], partnerUnderstood: sum('partnerUnderstood'), noIssuesFlagged: sum('noIssuesFlagged'),
    revisionsSent: sum('revisionsSent'), practiceAttempts: sum('practiceAttempts'), explorations: sum('explorations'), bot: sum('bot'),
  } : null
  return { rows, globalEffort, error: state.error, globalXp: state.rows ? state.rows.reduce((sum, row) => sum + row.xp, 0) : null }
}
