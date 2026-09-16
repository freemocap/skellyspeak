import { useI18n } from '../../../components/localization/i18n'
import type { ConnectionHealth } from '../../../state/session/connection-health'

export function ConnectionHealthPanel({ health, bearerAuth, disabled, onCheck }: {
  health?: ConnectionHealth; bearerAuth: boolean; disabled: boolean; onCheck: () => void
}) {
  const tr = useI18n()
  const checking = health?.status === 'checking'
  const serverState = checking ? 'checking' : health?.error ? 'rejected' : health?.providers ? 'accepted' : 'unchecked'
  const rows = [
    { name: tr('Server'), state: serverState, status: null, detail: serverState === 'accepted' ? tr('Reachable') : null },
    { name: tr('Server session token'), state: !bearerAuth ? 'disabled' : serverState, status: null, detail: null },
    ...(['OPENROUTER', 'GROQ'] as const).map(provider => {
      const result = health?.error ? undefined : health?.providers?.find(item => item.provider === provider)
      return { name: provider === 'OPENROUTER' ? 'OpenRouter' : 'Groq',
        state: checking ? 'checking' : result?.state ?? 'unchecked', status: result?.status,
        detail: provider === 'OPENROUTER' ? tr('Chat provider key') : tr('Transcription provider key') }
    }),
  ]
  const labels: Record<string, string> = { accepted: tr('Accepted'), rejected: tr('Rejected'), unreachable: tr('Unreachable'),
    invalid_response: tr('Invalid response'), checking: tr('Checking…'), unchecked: tr('Not checked'), disabled: tr('Disabled') }
  return <section className="connection-health-panel" aria-label={tr('Connection health')} aria-busy={checking}>
    <div className="connection-health-heading">
      <strong>{tr('Connection health')}</strong>
      <button type="button" className="btn" disabled={disabled || checking} onClick={onCheck}>
        <span aria-hidden="true">↻</span> {tr('Check connection')}
      </button>
    </div>
    <ul className="connection-health-grid" aria-live="polite">
      {rows.map(row => <li key={row.name} className="connection-health-item" data-state={row.state}>
        <span className="connection-health-icon" aria-hidden="true">{row.state === 'accepted' ? '✓' : ['rejected', 'unreachable', 'invalid_response'].includes(row.state) ? '×' : checking ? '↻' : '—'}</span>
        <span className="connection-health-name"><strong>{row.name}</strong>{row.detail && <small>{row.detail}</small>}</span>
        <span className="connection-health-badge">{labels[row.state]}{row.status && row.state !== 'accepted' ? ` · HTTP ${row.status}` : ''}</span>
      </li>)}
    </ul>
    {health?.error && <p role="alert">{health.error}</p>}
    {health?.checkedAt && <small>{tr('Last checked')}: {tr.dateTime(health.checkedAt)}</small>}
  </section>
}
