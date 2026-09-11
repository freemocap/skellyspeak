import { useEffect, useState } from 'react'
import { clearRuns, getGraph, getRuns, subscribeRuns, subscribeRunStarts } from '../../lib/tauri'
import type { Graph, Run, RunStarted } from '../../types'

export function interactionKey(run: Pick<Run, 'id' | 'turn_id'>): string {
  return run.turn_id === null ? `call:${run.id}` : `turn:${run.turn_id}`
}
export function mergeRuns(current: Run[], incoming: Run[]): Run[] {
  return [...new Map([...current, ...incoming].map((run) => [run.id, run])).values()]
    .sort((a, b) => a.started_at_ms - b.started_at_ms || a.id - b.id)
}
export function useActivity() {
  const [runs, setRuns] = useState<Run[]>([])
  const [active, setActive] = useState<RunStarted[]>([])
  const [graphs, setGraphs] = useState<Graph[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let alive = true
    const unsubs: (() => void)[] = []
    const keep = (stop: () => void): void => { if (alive) unsubs.push(stop); else stop() }
    const fail = (e: unknown): void => { if (alive) { setError(String(e)); setLoading(false) } }
    void (async () => {
      try {
        keep(await subscribeRuns((run) => {
          if (!alive) return
          setRuns((previous) => mergeRuns(previous, [run]))
          setActive((previous) => previous.filter((item) => item.id !== run.id))
        }))
        if (!alive) return
        keep(await subscribeRunStarts((run) => {
          if (alive) setActive((previous) => [...previous.filter((item) => item.id !== run.id), run])
        }))
        if (!alive) return
        const [history, declarations] = await Promise.all([getRuns(), getGraph()])
        if (alive) {
          setRuns((previous) => mergeRuns(history, previous)); setGraphs(declarations); setLoading(false)
        }
      } catch (e) { fail(e) }
    })()
    return () => { alive = false; unsubs.forEach((stop) => stop()) }
  }, [])
  const clear = async (): Promise<void> => {
    try { await clearRuns(); setRuns([]) }
    catch (failure) { setError(String(failure)); throw failure }
  }
  return { runs, active, graphs, error, loading, clear }
}
export type Activity = ReturnType<typeof useActivity>
