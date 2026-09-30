import { useConnectionHealth } from './connection-health'
import { useSessionStore } from './session'

/// The AI route's checked connection, as the AI pill shows it on every
/// recorder. It counts as connected only after a successful check at the
/// current revision; a saved key alone never does.
export interface AiAccess {
  status: 'connected' | 'checking' | 'disconnected'
  connected: boolean
  checking: boolean
  /// The current revision's last check failure.
  error: string | null
  /// When the current revision was last checked, in epoch milliseconds.
  checkedAt: number | null
  /// The configured audio models, named beside the steps they run.
  models: { transcription: string | null; speech: string | null }
}

export function useAiAccess(): AiAccess {
  const connection = useSessionStore(state => state.connection)
  const health = useConnectionHealth(state => connection ? state.routes[connection.route] : undefined)
  const current = health !== undefined && health.revision === connection?.revision
  // A re-check (on return to the app) keeps the last finished result until it
  // settles, so a working connection is never shown, or treated, as lost.
  const known = current && (health.status === 'checking' ? health.settled : health.status)
  const connected = Boolean(connection?.configured && known === 'connected')
  const checking = current && health.status === 'checking' && !connected
  return {
    status: connected ? 'connected' : checking ? 'checking' : 'disconnected',
    connected, checking,
    error: current ? health.error : null,
    checkedAt: current ? health.checkedAt : null,
    models: { transcription: connection?.audio.transcription.model ?? null, speech: connection?.audio.speech.model ?? null },
  }
}
