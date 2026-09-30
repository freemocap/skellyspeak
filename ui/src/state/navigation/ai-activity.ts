import { reportFault } from '../../platform/diagnostics/faults'
import { openAiWindow } from '../../platform/ipc/window'
import { useAiWindowStore } from './ai-window'
import { useNavigationStore } from './navigation'

/// Whether the AI View is showing, docked in this window or in its own.
export function useAiActivityOpen(): boolean {
  const docked = useNavigationStore(state => state.overlay === 'activity')
  const windowed = useAiWindowStore(state => state.open)
  return docked || windowed
}

/// What the AI pill opens. Known to be disconnected: AI access, where the
/// connection is fixed. Otherwise, connected or still being checked: the AI
/// View, focusing its own window when it has one.
export function openAiActivity(status: 'connected' | 'checking' | 'disconnected'): void {
  const navigation = useNavigationStore.getState()
  if (status === 'disconnected') { navigation.showOverlay('settings'); return }
  if (useAiWindowStore.getState().open) { openAiWindow().catch(error => reportFault('Focusing the AI window', error)); return }
  navigation.toggleOverlay('activity')
}
