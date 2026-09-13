import { useState } from 'react'
import { YamlExport } from '../../ui/YamlExport'
import { conversationYaml, saveConversationYaml } from '../../platform/ipc/conversation-export'

export function ConversationExport({ conversationId, onClose }: { conversationId: string; onClose: () => void }) {
  const [includeCoach, setIncludeCoach] = useState(false)
  const [includeBackend, setIncludeBackend] = useState(false)
  const options = { conversationId, includeCoach, includeBackend }
  return <YamlExport title="Conversation YAML" scope={JSON.stringify(options)}
    view={() => conversationYaml(options)} save={() => saveConversationYaml(options)} onClose={onClose}>
    <label><input type="checkbox" checked={includeCoach} onChange={event => setIncludeCoach(event.target.checked)} />Include coaching and private coach chat</label>
    <label><input type="checkbox" checked={includeBackend} onChange={event => setIncludeBackend(event.target.checked)} />Include backend activity (models, requests and token use)</label>
  </YamlExport>
}
