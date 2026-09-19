import { invoke } from './native'

export const supportsLogSharing = () => /Android/i.test(navigator.userAgent)
export const shareDiagnosticLogs = () => invoke<void>('share_diagnostic_logs')
