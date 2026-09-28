import type { SpeechAlignment, AudioInspection, DrillAttemptPage, DrillStorageView, DrillSessionView, DrillItemInput, DrillItemView } from '../../generated/contracts'
import { invoke } from './native'
import { inspectionResource, invalidateInspectionResources } from '../audio/inspection-resource'

function invalidateAudio(itemId?: string, attemptId?: string) {
  invalidateInspectionResources(key => {
    if (!key.startsWith('["drill",')) return false
    const [kind, input] = JSON.parse(key)
    return kind === 'drill' && (!itemId || input.itemId === itemId) && (!attemptId || input.attemptId === attemptId)
  })
}

/** Drill's own commands. Recording, transcription, reading aids and speech are
 * the shared ones; only the item, the attempt and the comparison live here. */
export function createDrillItem(input: DrillItemInput): Promise<DrillItemView> {
  return invoke<DrillItemView>('create_drill_item', { input })
}
export function drillItems(language: string): Promise<DrillItemView[]> {
  return invoke<DrillItemView[]>('get_drill_items', { language })
}
export async function deleteDrillItem(itemId: string): Promise<void> {
  await invoke<void>('delete_drill_item', { itemId })
  invalidateAudio(itemId)
}
/** Delete one take and its audio; the phrase and its other takes stay. */
export async function deleteDrillAttempt(attemptId: string): Promise<void> {
  await invoke<void>('delete_drill_attempt', { attemptId })
  invalidateAudio(undefined, attemptId)
}
/** Delete a phrase's takes recorded at or after `since` (UTC, stored form), or all of them. */
export async function clearDrillAttempts(itemId: string, since: string | null): Promise<number> {
  const count = await invoke<number>('clear_drill_attempts', { itemId, since })
  invalidateAudio(itemId)
  return count
}
/** The audio kept for one attempt, for replay. Rejects once it has been pruned. */
export function drillAttemptAudio(attemptId: string): Promise<string> {
  return invoke<string>('get_drill_attempt_audio', { attemptId })
}
/** Analyse audio belonging to this item: the reference, or a replayed attempt. */
export function inspectDrillAudio(itemId: string, audioBase64: string, evidence?: { attemptId?: string; speechAlignment?: SpeechAlignment | null }): Promise<AudioInspection> {
  const input = { itemId, audioBase64, ...evidence }
  return inspectionResource(JSON.stringify(['drill', input]), () => invoke<AudioInspection>('inspect_drill_audio', input))
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
export async function setDrillStorage(limitMb: number): Promise<DrillStorageView> {
  const result = await invoke<DrillStorageView>('set_drill_storage', { limitMb })
  invalidateAudio()
  return result
}

/** Opaque, item-bound cursor; new recordings appear on a fresh first page. */
export function drillAttempts(itemId: string, cursor: string | null = null, limit = 20): Promise<DrillAttemptPage> {
  return invoke('drill_attempts', { itemId, cursor, limit })
}

/** Most recently visited surviving phrase in this workspace and language. */
export function lastDrillItem(language: string): Promise<string | null> {
  return invoke('get_last_drill_item', { language })
}

