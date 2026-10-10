import { useCallback, useEffect, useState } from 'react'
import type { NativeRunEntry, NativeRunPage } from '../../generated/contracts'
import type { InspectionSnapshot } from '../../generated/graph-contracts'
import { listNativeWorkspaceRuns, readNativeRunHistory, readNativeWorkspaceGraph } from '../../platform/ipc/window'
import { nativeError } from '../../platform/ipc/workspace'
import { useI18n } from '../../components/localization/i18n'
import { ErrorNotice } from '../../components/feedback/ErrorNotice'
import { NativeGraphTimeline } from './NativeRunView'

function WorkspaceRun({ entry }: { entry: NativeRunEntry }) {
  const [graph, setGraph] = useState<InspectionSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const loadHistory = useCallback((before: string | null) => readNativeRunHistory(entry.engine, entry.run, before), [entry.engine, entry.run])
  const tr = useI18n()
  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let revision: string | null = null
    async function read() {
      try {
        const current = await readNativeWorkspaceGraph(entry.engine, entry.run, revision)
        if (!active) return
        if (current) {
          if (current.engine !== entry.engine || current.run !== entry.run || current.artifact_id !== entry.artifact)
            throw new Error('Graph history does not match the selected run.')
          revision = current.revision
          setGraph(current)
        }
        timer = setTimeout(() => void read(), 1000)
      } catch (cause) { if (active) setError(nativeError(cause)) }
    }
    void read()
    return () => { active = false; clearTimeout(timer) }
  }, [loadHistory, entry.engine, entry.run, entry.artifact])
  if (error) return <ErrorNotice as="p" error={error}>{error}</ErrorNotice>
  if (!graph) return <p role="status">{tr('Loading…')}</p>
  return <NativeGraphTimeline graph={graph} selected={selected} onSelect={setSelected} down={false} loadHistory={loadHistory} />
}

/** All run kinds come from persisted native ownership, not a UI operation catalog. */
export function WorkspaceGraphActivity() {
  const tr = useI18n()
  const [page, setPage] = useState<NativeRunPage | null>(null)
  const [entry, setEntry] = useState<NativeRunEntry | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function load(before: string | null = null) {
    setBusy(true); setError(null)
    try { setPage(await listNativeWorkspaceRuns(before)) } catch (cause) { setError(nativeError(cause)) } finally { setBusy(false) }
  }
  return <details>
    <summary>{tr('Graph')}</summary>
    <button type="button" className="ai-chip" disabled={busy} onClick={() => void load()}>{tr('Refresh')}</button>
    {error && <ErrorNotice as="p" error={error}>{error}</ErrorNotice>}
    {page && <label>{tr('Graph')} <select className="field" aria-label={tr('Graph')} value={entry ? JSON.stringify([entry.engine, entry.run]) : ''} onChange={event => {
      const next = page.runs.find(item => JSON.stringify([item.engine, item.run]) === event.target.value)
      setEntry(next ?? null)
    }}>
      <option value="">{tr('Choose a graph')}</option>
      {entry && !page.runs.some(item => item.engine === entry.engine && item.run === entry.run) && <option value={JSON.stringify([entry.engine, entry.run])}>{entry.kind} · {entry.run}</option>}
      {page.runs.map(item => <option key={JSON.stringify([item.engine, item.run])} value={JSON.stringify([item.engine, item.run])}>{item.kind} · {item.run}</option>)}
    </select></label>}
    {page?.before && <button type="button" className="ai-chip" disabled={busy} onClick={() => void load(page.before)}>{tr('Older')}</button>}
    {entry && <WorkspaceRun key={JSON.stringify([entry.engine, entry.run])} entry={entry} />}
  </details>
}
