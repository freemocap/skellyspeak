import type { SpeechAlignment, AudioInspection, DrillAttemptPage, DrillStorageView, DrillSessionView, DrillItemInput, DrillItemView } from '../../generated/contracts'
import { invoke } from './native'

/** Drill's own commands. Recording, transcription, reading aids and speech are
 * the shared ones; only the item, the attempt and the comparison live here. */
export function createDrillItem(input: DrillItemInput): Promise<DrillItemView> {
  return invoke<DrillItemView>('create_drill_item', { input })
}
export function drillItems(language: string): Promise<DrillItemView[]> {
  return invoke<DrillItemView[]>('get_drill_items', { language })
}
export function deleteDrillItem(itemId: string): Promise<void> {
  return invoke<void>('delete_drill_item', { itemId })
}
/** Delete one take and its audio; the phrase and its other takes stay. */
export function deleteDrillAttempt(attemptId: string): Promise<void> {
  return invoke<void>('delete_drill_attempt', { attemptId })
}
/** Delete a phrase's takes recorded at or after `since` (UTC, stored form), or all of them. */
export function clearDrillAttempts(itemId: string, since: string | null): Promise<number> {
  return invoke<number>('clear_drill_attempts', { itemId, since })
}
/** The audio kept for one attempt, for replay. Rejects once it has been pruned. */
export function drillAttemptAudio(attemptId: string): Promise<string> {
  return invoke<string>('get_drill_attempt_audio', { attemptId })
}
/** Analyse audio belonging to this item: the reference, or a replayed attempt. */
export function inspectDrillAudio(itemId: string, audioBase64: string, evidence?: { attemptId?: string; speechAlignment?: SpeechAlignment | null }): Promise<AudioInspection> {
  return invoke<AudioInspection>('inspect_drill_audio', { itemId, audioBase64, ...evidence })
}

export function startDrillSession(language: string): Promise<string> {
  return invoke('start_drill_session', { language })
}
export function endDrillSession(sessionId: string): Promise<void> {
  return invoke('end_drill_session', { sessionId })
}
export function enterDrillVisit(sessionId: string, itemId: string): Promise<string> {
  return invoke('enter_drill_visit', { sessionId, itemId })
}
export function leaveDrillVisit(visitId: string): Promise<void> {
  return invoke('leave_drill_visit', { visitId })
}

/** Mechanical history; counts belong to visits, never a UI-local match counter. */
export function drillSessions(language: string): Promise<DrillSessionView[]> {
  return invoke('get_drill_sessions', { language })
}

export function drillStorage(): Promise<DrillStorageView> { return invoke('get_drill_storage') }
export function setDrillStorage(limitMb: number): Promise<DrillStorageView> { return invoke('set_drill_storage', { limitMb }) }

/** Opaque, item-bound cursor; new recordings appear on a fresh first page. */
export function drillAttempts(itemId: string, cursor: string | null = null, limit = 20): Promise<DrillAttemptPage> {
  return invoke('drill_attempts', { itemId, cursor, limit })
}
