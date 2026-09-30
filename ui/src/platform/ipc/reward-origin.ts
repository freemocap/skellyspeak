import type { EffortAward } from '../../generated/contracts'

export interface RewardOrigin { x: number; y: number; at: number }
export interface ActionReward { award: EffortAward; origin: RewardOrigin }
const lifetime = 30 * 60_000
const origins = new Map<string, RewardOrigin>()
const pending = new Map<string, EffortAward>()
const shown = new Map<string, number>()
const listeners = new Set<(reward: ActionReward) => void>()
let activation: RewardOrigin | null = null

/** Remember the activation, not subsequent pointer movement. No coordinates are persisted. */
export function trackRewardActivations() {
  const pointer = (event: MouseEvent) => {
    if (event.detail === 0) {
      const rect = event.target instanceof Element ? event.target.getBoundingClientRect() : null
      activation = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, at: Date.now() } : null
    } else activation = { x: event.clientX, y: event.clientY, at: Date.now() }
  }
  const keyboard = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    const rect = event.target instanceof Element ? event.target.getBoundingClientRect() : null
    activation = rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, at: Date.now() } : null
  }
  document.addEventListener('click', pointer, true)
  document.addEventListener('keydown', keyboard, true)
  return () => { document.removeEventListener('click', pointer, true); document.removeEventListener('keydown', keyboard, true); activation = null }
}
export function captureRewardOrigin(): RewardOrigin | null {
  return activation && Date.now() - activation.at < 1000 ? { ...activation } : null
}
function prune() {
  const cutoff = Date.now() - lifetime
  for (const [key, origin] of origins) if (origin.at < cutoff) origins.delete(key)
  for (const [key, award] of pending) if (Date.parse(award.createdAt) < cutoff) pending.delete(key)
  for (const [key, at] of shown) if (at < cutoff) shown.delete(key)
  for (const map of [origins, pending, shown]) while (map.size > 500) map.delete(map.keys().next().value!)
}
export function bindRewardOrigin(source: string, origin: RewardOrigin | null = captureRewardOrigin()) {
  prune()
  if (!origin) return
  origins.set(source, origin)
  publishEffortAwards([...pending.values()])
}
export function inheritRewardOrigin(source: string, parent: string) {
  const origin = origins.get(parent)
  if (origin && (!origins.has(source) || origins.get(source)!.at < origin.at)) bindRewardOrigin(source, origin)
}
/** Actual award identities gate animation. Historical reads and duplicate publications stay quiet. */
export function publishEffortAwards(awards: readonly EffortAward[]) {
  prune()
  for (const award of awards) {
    if (shown.has(award.id)) continue
    const origin = origins.get(award.sourceId) ?? origins.get(award.sourceId.split(':')[0])
    const created = Date.parse(award.createdAt)
    if (!origin) { if (created >= Date.now() - lifetime) pending.set(award.id, award); continue }
    if (created < origin.at || origin.at < Date.now() - lifetime) continue
    shown.set(award.id, Date.now())
    pending.delete(award.id)
    for (const listener of listeners) listener({ award, origin })
  }
}
export function onActionReward(listener: (reward: ActionReward) => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
