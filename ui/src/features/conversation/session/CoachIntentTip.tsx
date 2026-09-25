import { useEffect, useState } from 'react'
import type { ConversationStartConfig, PromptPreview, RecommendationMode } from '../../../generated/contracts'
import { InfoTip } from '../../../components/controls/InfoTip'
import { useI18n } from '../../../components/localization/i18n'
import { invoke } from '../../../platform/ipc/native'
import { nativeError } from '../../../platform/ipc/workspace'

const modes: RecommendationMode[] = ['explore', 'continuePracticing', 'coachChoice']
const labels = { explore: 'Explore', continuePracticing: 'Continue practicing', coachChoice: 'Coach’s choice' }
type Choice = { mode: RecommendationMode; focus?: PromptPreview['coachFocus']; error?: string }

/** Read the same deterministic selection used when admitting a conversation. */
export function CoachIntentTip({ conversationId, configuration }: { conversationId: string; configuration: ConversationStartConfig }) {
  const tr = useI18n()
  const [open, setOpen] = useState(false)
  const [choices, setChoices] = useState<Choice[] | null>(null)
  const key = JSON.stringify(configuration)
  useEffect(() => {
    if (!open) return
    let current = true
    setChoices(null)
    void Promise.all(modes.map(async mode => {
      const draft: ConversationStartConfig = JSON.parse(key)
      draft.direction.topic = { kind: 'coach', mode }
      try {
        const preview = await invoke<PromptPreview>('preview_conversation_prompt', { conversationId, configuration: draft, yaml: null })
        return { mode, focus: preview.coachFocus }
      } catch (reason) { return { mode, error: nativeError(reason) } }
    })).then(value => { if (current) setChoices(value) })
    return () => { current = false }
  }, [open, conversationId, key])
  return <InfoTip onOpenChange={setOpen}>
    {tr('Choose from recorded experience and retry effort, not correctness.')}
    <br />{tr('Explore uses skills with little recorded experience. Continue practicing uses skills with retry effort. Coach’s choice mixes both.')}
    {open && !choices && <span role="status">{tr('Updating preview…')}</span>}
    {choices?.map(({ mode, focus, error }) => <span key={mode}>
      <br /><strong>{tr(labels[mode])}</strong>{': '}
      {error ? <span role="alert">{error}</span> : focus && <>
        {tr(focus.name)}{' · '}{tr(labels[focus.mode])}
        <br />{tr('Experience')}: {tr.number(focus.experience)}{' · '}{tr('Effort')}: {tr.number(focus.effort)}
      </>}
    </span>)}
  </InfoTip>
}
