import type { MessageHelp } from '../../generated/contracts'
import { executeAction, readWorkspace } from './workspace'

/** Native code owns source validation, deduplication and explicit retry. */
export async function requestMessageHelp(messageId: string, help: MessageHelp, retry = false): Promise<void> {
  await executeAction(await readWorkspace(), { kind: 'requestMessageHelp', messageId, help, retry })
}
