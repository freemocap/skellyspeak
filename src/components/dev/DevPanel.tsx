import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { clearLogs, getLogs, subscribeLogs, type LogEntry } from '../../lib/log'
import { getDiagnostics } from '../../lib/tauri'
import { RunsView } from '../RunsView'

// The observability surface itself — tabs and content, with no opinion about
// where it lives. Three consumers share this one implementation: the docked
// panel (desktop), the popped-out window, and the mobile swipe surface. A
// second copy is how these three would drift apart.

// React Flow is ~60kB gzipped — real weight on Android for a view most people
// never open. Split it out: the depth costs nothing until you go there, which
// is the disclosure principle applied to the bundle.
const AgentGraph = lazy(() =>
  import('../graph/AgentGraph').then((m) => ({ default: m.AgentGraph }))
)

const COLORS: Record<string, string> = {
  debug: 'var(--faint-d)',
  info: 'var(--mut-d)',
  warn: 'var(--amber)',
  error: '#e06c6c',
}

export type DevTab = 'graph' | 'runs' | 'logs'

export function DevPanel() {
  const [tab, setTab] = useState<DevTab>('graph')
  const [entries, setEntries] = useState<LogEntry[]>([...getLogs()])
  const [stats, setStats] = useState<[string, number][] | null>(null)
  const scroller = useRef<HTMLDivElement | null>(null)

  useEffect(() => subscribeLogs((e) => setEntries([...e])), [])
  useEffect(() => {
    void getDiagnostics()
      .then(setStats)
      .catch(() => setStats(null))
  }, [tab])
  useEffect(() => {
    if (tab === 'logs' && scroller.current) {
      scroller.current.scrollTop = scroller.current.scrollHeight
    }
  }, [entries, tab])

  return (
    <>
      <div className="logs-tabs">
        {/* Graph first: the map. Then the history, then raw logs — each rung
            one step further from "what is this system". */}
        {(['graph', 'runs', 'logs'] as DevTab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`logs-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'graph' && (
        <Suspense fallback={<div className="logs-line">— loading graph —</div>}>
          <AgentGraph />
        </Suspense>
      )}
      {tab === 'runs' && <RunsView />}
      {tab === 'logs' && (
        <>
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
        </>
      )}
    </>
  )
}
