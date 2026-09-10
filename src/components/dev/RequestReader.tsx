import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Run } from '../../types'
import { getRuns } from '../../lib/tauri'
import { openOverlay } from '../../lib/back'

export function RequestReader({ run, onClose }: { run: Run; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [runs, setRuns] = useState<Run[]>([])
  const [baseline, setBaseline] = useState('')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    void getRuns().then((items) => { if (alive) setRuns(items.filter((r) => r.id !== run.id && r.operation === run.operation)) }).catch((e: unknown) => { if (alive) setError(String(e)) })
    return () => { alive = false }
  }, [run.id, run.operation])
  useEffect(() => {
    const close = openOverlay(onClose)
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => { close(); window.removeEventListener('keydown', key) }
  }, [onClose])
  const previous = runs.find((r) => String(r.id) === baseline)
  const oldBlocks = previous?.attempts.at(-1)?.request?.blocks ?? []
  const blocks = run.attempts.at(-1)?.request?.blocks ?? []
  const changed = [...new Set([...blocks, ...oldBlocks].map((b) => b.id))].map((id) => ({ id, before: oldBlocks.find((b) => b.id === id)?.content, after: blocks.find((b) => b.id === id)?.content })).filter((b) => b.before !== b.after)
  const matches = (text: string) => text.toLocaleLowerCase().includes(query.toLocaleLowerCase())
  return createPortal(<div className="modal-backdrop" onClick={onClose}>
    <section className="modal request-reader" role="dialog" aria-modal="true" aria-label="Request audit" onClick={(e) => e.stopPropagation()}>
      <header><h2>{run.label} · request audit</h2><button type="button" className="btn" onClick={onClose}>Close</button></header>
      <div className="request-reader-controls"><input className="field" aria-label="Search recorded messages" placeholder="Search messages and prompt blocks…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <label>Compare <select value={baseline} onChange={(e) => setBaseline(e.target.value)}><option value="">Choose another {run.operation} call</option>{runs.map((r) => <option key={r.id} value={r.id}>#{r.id} · {r.context?.chat_id ?? 'standalone'} · {new Date(r.started_at_ms).toLocaleString()}</option>)}</select></label></div>
      {error && <p role="alert">{error}</p>}
      <div className="request-reader-body">
        {previous && <section><h3>Changed prompt blocks · #{previous.id} → #{run.id}</h3>{changed.length ? changed.map((block) => <details key={block.id} open><summary>{block.id}</summary><p>Before</p><pre>{block.before ?? '(absent)'}</pre><p>After</p><pre>{block.after ?? '(absent)'}</pre></details>) : <p>No recorded block changes. Compare request context and message history below.</p>}</section>}
        <details><summary>Captured request context</summary><pre>{JSON.stringify(run.context, null, 2)}</pre></details>
        {blocks.filter((b) => matches(`${b.id} ${b.source} ${b.content}`)).map((block) => <details key={block.id}><summary>{block.id} · {block.source}{!block.content && ' · omitted'}</summary><pre>{block.content}</pre></details>)}
        {run.attempts.map((attempt) => <section key={attempt.index}><h3>Attempt {attempt.index + 1} · {attempt.kind}</h3>
          {attempt.request?.truncated && <p role="alert">This request capture is truncated.</p>}
          <details><summary>Effective request parameters</summary><pre>{JSON.stringify(attempt.request?.parameters, null, 2)}</pre></details>
          {attempt.request?.messages.filter((message) => matches(message.content)).map((message, index) => <section key={index}><h4>{message.role}{message.truncated && ' · truncated'}</h4><pre>{message.content}</pre></section>)}
          <details><summary>Response{attempt.response_truncated && ' · truncated'}</summary><pre>{attempt.response ?? 'No response recorded.'}</pre></details>
        </section>)}
      </div>
    </section>
  </div>, document.body)
}
