import { invoke } from './native'
import { isTauri } from './tauri'
// iPadOS can identify itself as a Mac when requesting desktop content.
export const supportsLogSharing = () => isTauri && (
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
)
export const supportsLogSaving = () => isTauri
export const shareDiagnosticLogs = () => invoke<void>('share_diagnostic_logs')
export const saveDiagnosticLogs = () => invoke<string | null>('save_diagnostic_logs')
