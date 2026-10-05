import { useI18n } from '../localization/i18n'
import type { MessageTool } from './MessageTools'

type ToolBehavior = Omit<MessageTool, 'key' | 'label' | 'icon' | 'opensDialog'>

/** Shared tool identity; each owner supplies the behavior and progress it owns. */
export function useMessageToolDefinitions() {
  const tr = useI18n()
  return {
    translate: (behavior: ToolBehavior): MessageTool => ({ key: 'translate', label: tr('Translate'), icon: 'translate', ...behavior }),
    words: (behavior: ToolBehavior): MessageTool => ({ key: 'words', label: tr('Words'), icon: 'words', ...behavior }),
    pronunciation: (behavior: ToolBehavior): MessageTool => ({ key: 'sound', label: tr('Pronunciation'), icon: 'pronunciation', ...behavior }),
    analysis: (behavior: ToolBehavior): MessageTool => ({
      key: 'analysis', label: tr('Analysis'), icon: 'analysis', opensDialog: true, ...behavior,
    }),
    coach: (behavior: ToolBehavior): MessageTool => ({
      key: 'coach', label: tr('Coach'), icon: 'coach', opensDialog: true, ...behavior,
    }),
  }
}
