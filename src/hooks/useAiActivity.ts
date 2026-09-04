import { useEffect, useState } from 'react'
import { subscribeRunStarts, subscribeRuns } from '../lib/tauri'

/// Is any agent working right now?
///
/// The same two buses the graph view watches: `trace:run_started` announces an
/// operation beginning, `trace:run` announces one finishing. Counting the
/// difference is what lets the chrome say "something is happening in here"
/// while it happens — a button that only lit up after the work was over would
/// be advertising the moment it stopped being interesting.
///
/// Counted rather than a flag, because a turn runs eight operations that
/// overlap: the first one to finish must not switch the light off while six
/// others are still going.
export function useAiActivity(): boolean {
  const [running, setRunning] = useState(0)

  useEffect(() => {
    const unsubs: (() => void)[] = []
    let alive = true
    const keep = (u: () => void) => (alive ? unsubs.push(u) : u())

    void subscribeRunStarts(() => setRunning((n) => n + 1)).then(keep)
    // Never below zero: a run that started before this mounted still reports
    // its completion here, and a negative count would latch the light off.
    void subscribeRuns(() => setRunning((n) => Math.max(0, n - 1))).then(keep)

    return () => {
      alive = false
      unsubs.forEach((u) => u())
    }
  }, [])

  return running > 0
}
