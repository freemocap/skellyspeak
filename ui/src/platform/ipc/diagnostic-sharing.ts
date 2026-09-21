import { invoke } from './native'
import { isTauri } from './tauri'
export const supportsLogSharing = () => /Android/i.test(navigator.userAgent)
export const supportsLogSaving = () => isTauri
export const shareDiagnosticLogs = () => invoke<void>('share_diagnostic_logs')
export const saveDiagnosticLogs = () => invoke<string | null>('save_diagnostic_logs')
