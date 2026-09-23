import { ErrorNotice } from '../../../components/feedback/ErrorNotice'
import { ResponseDetails } from '../../../components/feedback/ResponseDetails'
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
    ...(health?.error ? [] : health?.providers ?? []).map(result => ({
      name: ({ OPENROUTER: 'OpenRouter', GROQ: 'Groq', ELEVENLABS: 'ElevenLabs' } as Record<string, string>)[result.provider] ?? result.provider,
      state: checking ? 'checking' : result.state, status: result.status,
      detail: result.provider === 'OPENROUTER' ? tr('Chat provider key')
        : result.provider === 'GROQ' ? tr('Transcription provider key') : tr('Audio provider key'),
    })),
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
    {health?.providers?.map(provider => <ResponseDetails key={provider.provider} value={provider.diagnostics} />)}
    {health?.error && <ErrorNotice as="p" error={health.error}>{health.error}</ErrorNotice>}
    {health?.checkedAt && <small>{tr('Last checked')}: {tr.dateTime(health.checkedAt)}</small>}
  </section>
}
