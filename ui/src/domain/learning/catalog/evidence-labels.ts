import { messageKey } from '../../localization/messages'
import type { SkillOutcome, SkillRecord } from '../evidence/skills'

/** Presentation labels only; persisted evidence retains its native enum values. */
const evidenceLabels: Record<SkillOutcome | SkillRecord['status'] | 'excluded' | 'direct' | 'contextual' | 'absent' | 'unclear', string> = {
  direct: messageKey('Direct use'),
  contextual: messageKey('Contextual use'),
  absent: messageKey('Not observed'),
  unclear: messageKey('Unclear'),
  demonstrated: messageKey('Demonstrated'),
  partial: messageKey('Partial'),
  not_demonstrated: messageKey('Not demonstrated'),
  not_observed: messageKey('Not observed'),
  uncertain: messageKey('Uncertain'),
  pending: messageKey('Pending'),
  complete: messageKey('Complete'),
  failed: messageKey('Failed'),
  superseded: messageKey('Superseded'),
  excluded: messageKey('Excluded'),
}
export function evidenceLabelKey(value: string): string {
  if (!Object.hasOwn(evidenceLabels, value)) throw new Error(`Unknown evidence state: ${value}`)
  return evidenceLabels[value as keyof typeof evidenceLabels]
}
const lenses: Record<string, string> = {
  pragmatics: messageKey('Pragmatics'),
  interaction: messageKey('Interaction'),
  function: messageKey('Function'),
}
export function lensLabelKey(value: string): string {
  if (!Object.hasOwn(lenses, value)) throw new Error(`Unknown learning lens: ${value}`)
  return lenses[value]
}
