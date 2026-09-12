import { useCallback, useState } from 'react'
import { RequestReader } from './RequestReader'
import type { Run } from '../../types'

export function RunDetails({ run }: { run: Run }) {
  const [reader, setReader] = useState(false)
  const closeReader = useCallback(() => setReader(false), [])
  const request = run.attempts.at(-1)?.request
  const violations = run.length_checks.flatMap((check) => check.violations)
  return <div className="activity-details">
    <p>{run.outcome === 'failed' ? 'This step failed.' : run.outcome === 'retried_then_ok' ? 'Completed after retrying.' : 'Model call completed.'} · {(run.duration_ms / 1000).toFixed(1)}s</p>
    {run.context && <p className="request-context-summary">{run.context.difficulty} · {run.context.trigger.replaceAll('_', ' ')} · message {run.context.message_id ?? '—'}<br />Chat {run.context.chat_id} · lesson revision {run.context.lesson_revision}</p>}
    <p>Application: {run.application_status.replaceAll('_', ' ')}</p>
    {violations.length > 0 && <div className="run-error" role="alert"><strong>Difficulty length check failed</strong><ul>{violations.map((v, i) => <li key={i}>{v}</li>)}</ul></div>}
    {run.length_checks.length > 0 && <details><summary>Response length checks{violations.length ? ' · violations' : ' · within measured limits'}</summary>{run.length_checks.map((check, i) => <p key={i}>#{i + 1}: {check.sentences} sentences · {check.words ?? 'unassessed'} words. {check.method}</p>)}</details>}
    <button className="btn" type="button" onClick={() => setReader(true)}>Read / compare requests</button>
    {reader && <RequestReader run={run} onClose={closeReader} />}
    <p className="run-model">{run.model}{run.usage?.total_tokens != null && ` · ${run.usage.total_tokens} tokens`}</p>
    {run.output && <div className="run-preview"><span>Response preview</span><pre>{run.output.slice(0, 500)}{run.output.length > 500 ? '…' : ''}</pre></div>}
    {run.error && <p role="alert" className="run-error">{run.error}</p>}
    <details><summary>Model, timing &amp; usage</summary><dl>
      <dt>Model</dt><dd>{run.model}</dd>
      <dt>Reasoning parameter</dt><dd>{JSON.stringify(request?.parameters.reasoning ?? null)}</dd>
      <dt>First token</dt><dd>{run.first_token_ms === null ? 'Not recorded' : `${run.first_token_ms}ms`}</dd>
      <dt>Tokens</dt><dd>{run.usage?.total_tokens ?? 'Not reported'}</dd>
      <dt>Cost</dt><dd>{run.usage?.cost == null ? 'Not reported' : `$${run.usage.cost.toFixed(5)}`}</dd>
      <dt>Temperature</dt><dd>{run.temperature ?? 'Not set'}</dd>
      <dt>Token limit</dt><dd>{run.max_tokens ?? 'Not set'}</dd>
      <dt>Schema</dt><dd>{run.schema ?? 'None'}</dd>
    </dl></details>
    <details><summary>Attempts · {run.attempts.length}</summary>
      {run.attempts.map((attempt) => <details key={attempt.index}><summary>#{attempt.index + 1} · {attempt.kind.replaceAll('_', ' ')} · {attempt.duration_ms}ms</summary>{attempt.error && <p>{attempt.error}</p>}<pre>{JSON.stringify(attempt.request, null, 2)}</pre><pre>{attempt.response ?? 'No response recorded.'}</pre></details>)}
    </details>
    <details><summary>Captured request context</summary><pre>{JSON.stringify(run.context, null, 2)}</pre></details>
    <details><summary>Actual prompt sent</summary>{request ? <div className="recorded-messages">{request.truncated && <p role="alert">Capture truncated. See per-message markers.</p>}{request.messages.map((message, index) => <section key={index}><strong>{message.role}</strong><pre>{message.content}</pre></section>)}</div> : <p>Request not recorded.</p>}</details>
    <details><summary>Raw model response</summary>{run.output ? <pre>{run.output}</pre> : <p>Response not recorded.</p>}</details>
  </div>
}
