import { invoke as callNative } from '@tauri-apps/api/core'
import { logDiagnostic } from '../diagnostics/log'

/** Every application IPC rejection is observable before a caller displays it. */
export async function invoke<T>(command: string, args?: Parameters<typeof callNative>[1], signal?: AbortSignal): Promise<T> {
  try { return await callNative<T>(command, args) }
  catch (error) {
    const context = command.startsWith('mic_') ? 'microphone'
      : command.includes('speech') ? 'speech'
      : /settings|access|connection|credential/.test(command) ? 'settings'
      : /conversation|snapshot|execute_command/.test(command) ? 'conversation' : 'application'
    const failure = error as { code?: string; diagnostics?: { error?: { diagnostics?: { reason?: string } } } } | null
    const cancelled = command === 'run_reading' && signal?.aborted
      && failure?.code === 'conflict' && failure.diagnostics?.error?.diagnostics?.reason === 'cancelled'
    await logDiagnostic(context, error, undefined, 'native_command_failed', cancelled ? 'info' : 'error', { command })
    throw error
  }
}
