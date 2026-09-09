import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { clearLogs, getLogs, subscribeLogs, type LogEntry } from '../../lib/log'
import { getDiagnostics, invoke } from '../../lib/tauri'
import { useActivity, interactionKey } from './activity'
import { PanelBoundary } from './PanelBoundary'
import { GateControls } from '../graph/GateControls'
import { resumePipeline, useGate } from '../../lib/gate'

// Docked, pop-out and mobile views share the same live graph and inspection tools.
const AgentGraph = lazy(() =>
  import('../graph/AgentGraph').then((m) => ({ default: m.AgentGraph }))
)

const COLORS: Record<string, string> = {
  debug: 'var(--faint-d)',
  info: 'var(--mut-d)',
  warn: 'var(--amber)',
  error: '#e06c6c',
}

export function DevPanel() {
  const [debugOpen, setDebugOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const activity = useActivity()
  const gate = useGate()
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [chat, setChat] = useState('')
  const [exportPath, setExportPath] = useState<string | null>(null)
  const [retention, setRetention] = useState<{ evicted: number } | null>(null)
  const chatIds = [...new Set(activity.runs.flatMap((run) => run.context ? [run.context.chat_id] : []))]
  const visibleActive = activity.active.filter((run) => !chat || run.context?.chat_id === chat)
  const visibleRuns = activity.runs.filter((run) => !chat || run.context?.chat_id === chat)
  const [selection, setSelection] = useState('latest')
  const interactions = useMemo(() => {
    const items = [...visibleRuns, ...visibleActive].sort((a, b) => b.started_at_ms - a.started_at_ms || b.id - a.id)
    return [...new Map(items.map((item) => [interactionKey(item), { key: interactionKey(item), label: item.turn_id === null ? item.label : `Exchange ${item.turn_id}` }])).values()]
  }, [activity.runs, activity.active, chat])
  const selectedKey = selection === 'latest' ? interactions[0]?.key : selection
  const scopedRuns = useMemo(() => visibleRuns.filter((run) => selection === 'session' || interactionKey(run) === selectedKey), [activity.runs, selection, selectedKey, chat])
  const scopedActive = useMemo(() => visibleActive.filter((run) => selection === 'session' || interactionKey(run) === selectedKey), [activity.active, selection, selectedKey, chat])
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null)
  const [entries, setEntries] = useState<LogEntry[]>([...getLogs()])
  const [stats, setStats] = useState<[string, number][] | null>(null)
  const scroller = useRef<HTMLDivElement | null>(null)

  useEffect(() => { void invoke<{ evicted: number }>('get_trace_retention').then(setRetention).catch((e: unknown) => setDiagnosticError(String(e))) }, [activity.runs.length])
  useEffect(() => subscribeLogs((e) => setEntries([...e])), [])
  useEffect(() => {
    if (!debugOpen) return
    void getDiagnostics()
      .then(setStats)
      .catch((e: unknown) => setDiagnosticError(String(e)))
  }, [debugOpen])
  useEffect(() => {
    if (debugOpen && scroller.current) {
      scroller.current.scrollTop = scroller.current.scrollHeight
    }
  }, [entries, debugOpen])

  return (
    <>
      {gate.paused && <div className="gate-bar paused">Pipeline paused <button type="button" onClick={resumePipeline}>Resume</button></div>}
      <div className="activity-selection">
        <label>Chat <select aria-label="Filter traces by chat" value={chat} onChange={(e) => { setChat(e.target.value); setSelection('latest') }}><option value="">All retained chats</option>{chatIds.map((id) => <option key={id} value={id}>{id}</option>)}</select></label>
        <label>Inspect <select value={selection} onChange={(event) => setSelection(event.target.value)}>
          <option value="latest">Latest activity</option><option value="session">All retained activity</option>
          {interactions.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
        </select></label>
        <span className="activity-signal">{scopedActive.length ? `${scopedActive.length} running` : scopedRuns.length ? `${scopedRuns.length} calls recorded` : 'Awaiting activity'}</span>
        <div className="activity-tools">
          <button type="button" disabled={!scopedRuns.length} onClick={() => {
            setExportPath(null)
            void invoke<string>('export_runs', { ids: scopedRuns.map((r) => r.id) }).then(setExportPath).catch((e: unknown) => setDiagnosticError(String(e)))
          }}>Export selected</button>
          <button type="button" aria-expanded={helpOpen} onClick={() => setHelpOpen((open) => !open)}>How it works</button>
          <button type="button" aria-expanded={debugOpen} onClick={() => setDebugOpen((open) => !open)}>Debug {debugOpen ? '▴' : '▾'}</button>
        </div>
      </div>
      {exportPath && <p className="request-context-summary">Saved local audit export: <span>{exportPath}</span></p>}
      {retention && retention.evicted > 0 && <p className="request-context-summary">{retention.evicted} older traces were evicted by retention limits.</p>}
      {diagnosticError && <p role="alert">{diagnosticError}</p>}
      {activity.error && <p className="activity-error" role="alert">{activity.error}</p>}
      {helpOpen && <div className="activity-guide">
        <p>The partner replies while language tools add meanings, translation and suggestions. The coach reviews your words and updates inferred teaching notes. Follow the connections; select any node or call to inspect it.</p>
        <p>Each operation receives its own captured context. Replies and suggestions share an explicit difficulty policy; inferred proficiency remains a separate input. Read a node’s actual prompt to see what was sent; edit current choices in Lesson.</p>
        <p>Traces are retained locally across restarts within size and count limits. Filter by chat and inspect the captured request, rather than assuming current settings describe an older call. All-retained mode shows the latest call per operation across exchanges. Model completion and response length checks are separate results.</p>
      </div>}
      <PanelBoundary>
        {activity.loading ? <p className="logs-line">Loading activity…</p> : <Suspense fallback={<p className="logs-line">Loading pipeline…</p>}>
          <AgentGraph runs={scopedRuns} activeRuns={scopedActive} mode="explore" />
        </Suspense>}
      </PanelBoundary>
      {debugOpen && (
        <div className="debug-view">
          <GateControls />
          <button type="button" className="logs-clear" onClick={() => {
            void activity.clear().then(() => setSelection('latest')).catch((e: unknown) => setDiagnosticError(String(e)))
          }}>Clear retained traces</button>
          <details onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}><summary>Advanced graph workspace</summary>{advancedOpen && <div className="debug-graph"><PanelBoundary><Suspense fallback={<p>Loading graph…</p>}><AgentGraph runs={scopedRuns} activeRuns={scopedActive} mode="debug" /></Suspense></PanelBoundary></div>}</details>
          {diagnosticError && <p role="alert">{diagnosticError}</p>}
          <details><summary>Raw logs</summary>
          <div className="logs-head">
            <span>Logs</span>
            {stats && stats.some(([, v]) => v > 0) && (
              <span className="logs-stats">
                {stats
                  .filter(([, v]) => v > 0)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(' · ')}
              </span>
            )}
            <button type="button" className="logs-clear" onClick={() => clearLogs()}>
              clear
            </button>
          </div>
          <div className="logs-body" ref={scroller}>
            {entries.length === 0 && <div className="logs-line">— no logs —</div>}
            {entries.map((e, i) => (
              <div key={i} className="logs-line" style={{ color: COLORS[e.level] }}>
                <span className="logs-t">
                  {new Date(e.ts).toLocaleTimeString(undefined, { hour12: false })}
                </span>{' '}
                {e.message}
              </div>
            ))}
          </div>
          </details>
        </div>
      )}
    </>
  )
}
