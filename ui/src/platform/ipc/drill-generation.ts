import type { ConversationDrillInput, ConversationDrillPage, DrillGenerationInput, DrillGenerationPreview, DrillItemView, PersonaGenerationActivity } from '../../generated/contracts'
import { invoke } from './native'
import { ownedRequest } from './owned-request'

export function beginDrillPreview(input: DrillGenerationInput): Promise<string> {
  return invoke('begin_drill_preview', { input })
}
export function runDrillPreview(requestId: string): Promise<DrillGenerationPreview> {
  return invoke('preview_drill_items', { requestId })
}
export function cancelDrillPreview(requestId: string): Promise<void> {
  return invoke('cancel_drill_preview', { requestId })
}
/** One explicit paid request. Regeneration must call this again explicitly. */
export function previewDrillItems(input: DrillGenerationInput, signal: AbortSignal): Promise<DrillGenerationPreview> {
  return ownedRequest(signal, () => beginDrillPreview(input), runDrillPreview, cancelDrillPreview, 'Cancelling Drill generation')
}
export function getDrillPreview(requestId: string): Promise<DrillGenerationPreview> {
  return invoke('get_drill_preview', { requestId })
}
export function acceptDrillItems(requestId: string, candidateIds: string[]): Promise<DrillItemView[]> {
  return invoke('accept_drill_items', { requestId, candidateIds })
}
export function discardDrillPreview(requestId: string): Promise<void> {
  return invoke('discard_drill_preview', { requestId })
}
export function conversationDrillCandidates(input: ConversationDrillInput): Promise<ConversationDrillPage> {
  return invoke('conversation_drill_candidates', { input })
}
/** Same receipt shape as persona generation; this view contains only Drill work. */
export function drillGenerationActivity(): Promise<PersonaGenerationActivity> {
  return invoke('get_drill_generation_activity')
}
