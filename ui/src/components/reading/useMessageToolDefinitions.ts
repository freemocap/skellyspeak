import { useI18n } from '../localization/i18n'
import type { MessageTool } from './MessageTools'

type ToolBehavior = Omit<MessageTool, 'key' | 'label' | 'opensDialog'>

/** Shared tool identity; each owner supplies the behavior and progress it owns. */
export function useMessageToolDefinitions() {
  const tr = useI18n()
  return {
    words: (behavior: ToolBehavior): MessageTool => ({ key: 'words', label: tr('Words'), ...behavior }),
    details: (kind: 'coach' | 'analysis', behavior: ToolBehavior): MessageTool => ({
      key: kind, label: kind === 'coach' ? tr('Coach') : tr('Analysis'), opensDialog: true, ...behavior,
    }),
  }
}
