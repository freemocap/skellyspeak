import { useI18n } from '../../components/i18n'
import { useEffect, useState } from 'react'
import type { PersonaGenerationActivity } from '../../generated/contracts'
import { nativeError, readPersonaGenerationActivity } from '../../platform/ipc/workspace'

/** Global receipts have no conversation owner. Poll metadata without starting AI work. */
export function GenerationActivity() {
  const tr = useI18n()
  const [snapshot, setSnapshot] = useState<PersonaGenerationActivity | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    setSnapshot(null); setError(null)
    const read = async () => {
      try {
        const next = await readPersonaGenerationActivity()
        if (stopped) return
        setSnapshot(current => current?.revision === next.revision ? current : next)
        // Schedule after completion: a slow read must not accumulate concurrent polls.
        timer = setTimeout(() => { void read() }, 1000)
      } catch (failure) {
        if (!stopped) { setSnapshot(null); setError(nativeError(failure)) }
      }
    }
    void read()
    return () => { stopped = true; clearTimeout(timer) }
  }, [refresh])

  return <details className="generation-activity" open>
    <summary>{tr("Persona generation · Global")}</summary>
    {error && <p role="alert">{error} <button type="button" className="btn" onClick={() => setRefresh(value => value + 1)}>{tr("Retry generation activity")}</button></p>}
    {!snapshot && !error && <p role="status">{tr("Loading generation activity…")}</p>}
    {snapshot && <>
      <table><caption>{tr("All retained dispatched attempts")}</caption><tbody>
        <tr><th scope="row">{tr("Attempts")}</th><td>{snapshot.usage.attempts}</td></tr>
        <tr><th scope="row">{tr("Reported input tokens")}</th><td>{snapshot.usage.inputTokens ?? '—'}</td></tr>
        <tr><th scope="row">{tr("Reported output tokens")}</th><td>{snapshot.usage.outputTokens ?? '—'}</td></tr>
        <tr><th scope="row">{tr("Attempts with unknown usage")}</th><td>{snapshot.usage.unknownUsage}</td></tr>
      </tbody></table>
      <p>{tr("Recent generation receipts · Up to 50")}</p>
      {snapshot.attempts.length === 0 && <p>{tr("No recorded persona generations.")}</p>}
      {snapshot.attempts.slice(0, 50).map(attempt => <details key={attempt.id}>
        <summary>{attempt.state} · {attempt.languageId} · {attempt.createdAt}</summary>
        <dl>
          <dt>{tr("Generation ID")}</dt><dd>{attempt.id}</dd>
          <dt>{tr("Attempt ID")}</dt><dd>{attempt.attemptId}</dd>
          <dt>{tr("Operation ID")}</dt><dd>{attempt.operationId}</dd>
          <dt>{tr("Route")}</dt><dd>{attempt.route}</dd>
          <dt>{tr("Requested model")}</dt><dd>{attempt.requestedModel}</dd>
          <dt>{tr("Actual model")}</dt><dd>{attempt.actualModel ?? '—'}</dd>
          <dt>{tr("Provider ID")}</dt><dd>{attempt.providerId ?? '—'}</dd>
          <dt>{tr("Connection revision")}</dt><dd>{attempt.profileRevision}</dd>
          <dt>{tr("Dispatched")}</dt><dd>{attempt.dispatchedAt ?? '—'}</dd>
          <dt>{tr("Finished")}</dt><dd>{attempt.finishedAt ?? '—'}</dd>
          <dt>{tr("Input / output tokens")}</dt><dd>{attempt.inputTokens ?? '—'} / {attempt.outputTokens ?? '—'}</dd>
        </dl>
        {attempt.error && <p>{attempt.error}</p>}
      </details>)}
    </>}
  </details>
}
