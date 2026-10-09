import { useState } from 'react'
import type { TurnControl, TurnView } from '../../generated/contracts'
import { executeAction, nativeError, readWorkspace } from '../../platform/ipc/workspace'
import { useI18n } from '../../components/localization/i18n'
import { ErrorNotice } from '../../components/feedback/ErrorNotice'

export function NativeRunControls({ turn, globallyPaused }: { turn: TurnView; globallyPaused: boolean }) {
  const tr = useI18n()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const graph = turn.nativeGraph
  if (!graph || turn.nativeExecutionAvailable === false || !['pending', 'assisting'].includes(turn.state)) return null
  const control = async (action: TurnControl) => {
    setBusy(true); setError(null)
    try { await executeAction(await readWorkspace(), { kind: 'controlTurn', turnId: turn.id, control: action }) }
    catch (cause) { setError(nativeError(cause)) }
    finally { setBusy(false) }
  }
  return <div className="ai-view-actions">
    <button type="button" className="ai-chip" disabled={busy} onClick={() => void control(turn.paused ? 'resume' : 'pause')}>{turn.paused ? tr('Resume exchange') : tr('Pause')}</button>
    <button type="button" className="ai-chip" disabled={busy || !turn.paused || globallyPaused || !!turn.hold || !graph.step_available} onClick={() => void control('step')}>{tr('Step')}</button>
    <button type="button" className="ai-chip" disabled={busy} onClick={() => void control('cancel')}>{tr('Cancel')}</button>
    {error && <ErrorNotice as="p" error={error}>{error}</ErrorNotice>}
  </div>
}
