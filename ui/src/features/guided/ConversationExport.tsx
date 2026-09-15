import { useI18n } from '../../ui/i18n'
import { useState } from 'react'
import { YamlExport } from '../../ui/YamlExport'
import { conversationYaml, saveConversationYaml } from '../../platform/ipc/conversation-export'

export function ConversationExport({ conversationId, onClose }: { conversationId: string; onClose: () => void }) {
  const tr = useI18n()
  const [includeCoach, setIncludeCoach] = useState(false)
  const [includeBackend, setIncludeBackend] = useState(false)
  const options = { conversationId, includeCoach, includeBackend }
  return <YamlExport title={tr("Conversation YAML")} scope={JSON.stringify(options)}
    view={() => conversationYaml(options)} save={() => saveConversationYaml(options)} onClose={onClose}>
    <label><input type="checkbox" checked={includeCoach} onChange={event => setIncludeCoach(event.target.checked)} />{tr("Include coaching and private coach chat")}</label>
    <label><input type="checkbox" checked={includeBackend} onChange={event => setIncludeBackend(event.target.checked)} />{tr("Include backend activity (models, requests and token use)")}</label>
  </YamlExport>
}
