import { useCallback, useEffect, useRef, useState } from 'react'
import type { MicrophoneTestStarted } from '../../generated/contracts'
import { MicrophoneMonitor, type MicrophoneHealth } from '../../domain/audio/microphone-health'
import { invoke } from '../ipc/native'
import { reportFault } from '../diagnostics/faults'
import { startBrowserRecording, type BrowserRecording } from './browser-recording'
import { beginCapture, endCapture } from './speech'

interface TestSession { id: string; cancelled: boolean; token: object | null; capture: BrowserRecording | null; timer?: ReturnType<typeof setInterval>; end?: ReturnType<typeof setTimeout>; ready: Promise<void> }

/** Explicit, local level test. No finish/transcribe call and no saved audio. */
export function useMicrophoneTest(device: string | null) {
  const [phase, setPhase] = useState<'idle' | 'starting' | 'testing' | 'stopping'>('idle')
  const [health, setHealth] = useState<MicrophoneHealth | null>(null)
  const [label, setLabel] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)
  const run = useRef<TestSession | null>(null)
  const stop = useCallback(async () => {
    const session = run.current
    if (!session || session.cancelled) return
    session.cancelled = true
    setPhase('stopping')
    clearInterval(session.timer); clearTimeout(session.end)
    await session.ready
    session.capture?.cancel()
    try { await invoke('microphone_test_stop', { testId: session.id }) }
    catch (reason) {
      setError(reason); reportFault('Stopping microphone test', reason)
      session.cancelled = false; setPhase('testing')
      return // Keep capture exclusion until a retry acknowledges the stop.
    }
    if (session.token) endCapture(session.token)
    if (run.current === session) { run.current = null; setPhase('idle') }
  }, [])
  useEffect(() => () => { void stop() }, [device, stop])
  const start = async () => {
    if (run.current) return
    const session: TestSession = { id: crypto.randomUUID(), cancelled: false, token: null, capture: null, ready: Promise.resolve() }
    run.current = session
    setPhase('starting'); setError(null); setHealth(null); setLabel(null)
    session.ready = (async () => {
      session.token = beginCapture(() => { void stop() })
      const result = await invoke<MicrophoneTestStarted>('microphone_test_start', { testId: session.id, device })
      if (session.cancelled) return
      if (result.browserCapture) session.capture = await startBrowserRecording(reason => { setError(reason); void stop() }, () => Promise.resolve(), device)
      if (session.cancelled) return
      setLabel(session.capture?.deviceLabel ?? result.deviceLabel)
      const monitor = new MicrophoneMonitor(performance.now())
      setPhase('testing')
      let polling = false
      session.timer = setInterval(() => {
        if (polling || session.cancelled) return
        polling = true
        void (async () => {
          const samples = session.capture ? session.capture.wave.read() : await invoke<number[]>('microphone_test_samples', { testId: session.id })
          if (session.cancelled) return
          const next = monitor.update(samples, performance.now())
          setHealth(next)
          if (next.signal === 'stalled') void stop()
        })().catch(reason => { setError(reason); void stop() }).finally(() => { polling = false })
      }, 100)
      session.end = setTimeout(() => { void stop() }, 15000)
    })().catch(reason => { setError(reason); reportFault('Testing microphone', reason) })
    await session.ready
    // Startup failures have no live polling timer to clean them up.
    if (!session.timer && !session.cancelled) await stop()
  }
  return { phase, health, label, error, start, stop }
}
