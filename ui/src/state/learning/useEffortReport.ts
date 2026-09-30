import { useEffect, useRef, useState } from 'react'
import type { EffortDimension, EffortReport } from '../../generated/contracts'
import { getEffortReport } from '../../platform/ipc/effort'
import { errorMessage } from '../../platform/diagnostics/error-details'

export function useEffortReport(target: string, dimension: EffortDimension | null, revision: unknown) {
  const generation = useRef(0)
  const busy = useRef(false)
  const [state, setState] = useState<{ target: string; dimension: EffortDimension | null; report: EffortReport | null; error: string | null; loading: boolean }>({ target, dimension, report: null, error: null, loading: true })
  useEffect(() => {
    const request = ++generation.current
    busy.current = true
    setState({ target, dimension, report: null, error: null, loading: true })
    void getEffortReport(target, dimension, null).then(report => {
      if (request === generation.current) setState({ target, dimension, report, error: null, loading: false })
    }).catch(error => {
      if (request === generation.current) setState({ target, dimension, report: null, error: errorMessage(error), loading: false })
    }).finally(() => { if (request === generation.current) busy.current = false })
    return () => { generation.current++ }
  }, [target, dimension, revision])
  const current = state.target === target && state.dimension === dimension
  async function more() {
    if (!current || !state.report?.next || busy.current) return
    const request = generation.current
    busy.current = true
    setState(previous => ({ ...previous, loading: true, error: null }))
    try {
      const page = await getEffortReport(target, dimension, state.report.next)
      if (request === generation.current) setState(previous => ({ ...previous, loading: false, report: { ...page, entries: [...(previous.report?.entries ?? []), ...page.entries] } }))
    } catch (error) {
      if (request === generation.current) setState(previous => ({ ...previous, loading: false, error: errorMessage(error) }))
    } finally { if (request === generation.current) busy.current = false }
  }
  return { report: current ? state.report : null, error: current ? state.error : null, loading: !current || state.loading, more }
}
