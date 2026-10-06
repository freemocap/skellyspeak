import { ReadingInspector } from '../../../components/reading/ReadingHelp'
import { useReadingScope } from '../../../components/reading/ReadingContext'
import { languages } from '../../../platform/ipc/tauri'
import type { GuidedTurnResult } from '../../../types'
import { useMemo } from 'react'

/** Explain the selected partner text, independently of learner assessment and turn help. */
export function PartnerMessageAnalysis({ assistant, conversationId, onClose }: {
  assistant: GuidedTurnResult
  conversationId?: string
  onClose: () => void
}) {
  const inheritedScope = useReadingScope()
  const scope = assistant.help?.scope ?? inheritedScope
  const selection = useMemo(() => scope ? {
    text: assistant.reply, start: 0, end: assistant.reply.length,
    scope: { ...scope, conversationId }, aid: 'explanations' as const,
  } : null, [assistant.reply, scope?.language, scope?.variety, scope?.explanation, scope?.explanationVariety, conversationId])
  if (!selection) throw new Error('Partner message analysis requires a reading scope')
  return <ReadingInspector languages={languages()} onClose={onClose} selection={selection} />
}
