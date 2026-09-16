import { useEffect } from 'react'
import { useSessionStore } from '../state/session/session'
import { useConnectionHealth } from '../state/session/connection-health'

/** Probe on startup, configuration changes and return to the app, never inference. */
export function useConnectionHealthChecks() {
  const connection = useSessionStore(state => state.connection)
  useEffect(() => {
    if (!connection) return
    const check = () => { if (document.visibilityState !== 'hidden') void useConnectionHealth.getState().check(connection) }
    const online = () => { void useConnectionHealth.getState().check(connection, true) }
    const offline = () => useConnectionHealth.getState().offline()
    if (navigator.onLine === false) offline()
    else check()
    window.addEventListener('focus', check)
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.removeEventListener('focus', check)
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
      document.removeEventListener('visibilitychange', check)
    }
  }, [connection?.route, connection?.revision, connection?.configured])
}
