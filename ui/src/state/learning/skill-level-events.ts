import { create } from 'zustand'
import { useEffect, useRef } from 'react'
import { claimSkillLevelEvents, initializeSkillLevelEvents } from '../../platform/ipc/skill-levels'
import { reportFault } from '../../platform/diagnostics/faults'
import type { SkillLevelEvent } from '../../generated/contracts'
import type { SkillSnapshot } from '../../domain/learning/evidence/skills'

/// The one language-level celebration queue.
///
/// Native records each level step once and hands out unclaimed steps in order.
/// This owner initializes catch-up for the active language, groups the pending
/// steps into presentations, claims exactly those just before showing them, and
/// reads evidence again for the next batch. Current levels are always shown from
/// the snapshot; this queue only drives the celebration layer on top.

/** Skill steps are shown together; each language step gets its own moment. */
export type LevelPresentation =
  | { kind: 'skills'; events: SkillLevelEvent[] }
  | { kind: 'language'; event: SkillLevelEvent }

/** Consecutive skill steps collapse into one presentation; a language step ends a group. */
export function groupLevelEvents(events: SkillLevelEvent[]): LevelPresentation[] {
  const groups: LevelPresentation[] = []
  let skills: SkillLevelEvent[] = []
  for (const event of events) {
    if (event.kind === 'skill_level') {
      if (!event.skillId) throw new Error(`Skill level event ${event.id} has no skill`)
      skills.push(event)
      continue
    }
    if (skills.length) { groups.push({ kind: 'skills', events: skills }); skills = [] }
    groups.push({ kind: 'language', event })
  }
  if (skills.length) groups.push({ kind: 'skills', events: skills })
  return groups
}

interface LevelEventState {
  /** Language and profile revision whose catch-up has been initialized. */
  initialized: string | null
  /** A batch is being initialized or claimed. */
  working: boolean
  showing: LevelPresentation | null
  queue: LevelPresentation[]
  /** Show the next presentation, or finish the batch. Returns true when the batch finished. */
  advance: () => boolean
}

export const useSkillLevelEventStore = create<LevelEventState>((set, get) => ({
  initialized: null,
  working: false,
  showing: null,
  queue: [],
  advance: () => {
    const [next, ...rest] = get().queue
    set({ showing: next ?? null, queue: rest })
    return next === undefined
  },
}))

const CLAIM_LIMIT = 100

/** Claim an ordered prefix and queue what native returned. Only returned events are shown. */
async function claimAndPresent(target: string, pending: SkillLevelEvent[], stillCurrent: () => boolean, reload: () => void): Promise<void> {
  const batch = [...pending].sort((left, right) => left.sequence - right.sequence).slice(0, CLAIM_LIMIT)
  if (!batch.length) return
  // Prepare before claiming, so a claimed step always has a presentation ready.
  const prepared = groupLevelEvents(batch)
  if (!stillCurrent()) return
  const claimed = await claimSkillLevelEvents(target, batch.map(event => event.id))
  if (!stillCurrent()) return
  const returned = new Set(claimed.map(event => event.id))
  const presentations = prepared
    .map(group => group.kind === 'skills' ? { ...group, events: group.events.filter(event => returned.has(event.id)) } : group)
    .filter(group => group.kind === 'skills' ? group.events.length > 0 : returned.has(group.event.id))
  const [first, ...rest] = presentations
  // Nothing left to show (all claimed elsewhere): read again rather than claim the same steps twice.
  if (!first) { reload(); return }
  useSkillLevelEventStore.setState({ showing: first, queue: rest })
}

/** Each snapshot's pending list is acted on once; the next read brings the next batch. */
const processed = new WeakSet<SkillSnapshot>()

function visible(): boolean {
  return document.visibilityState === 'visible'
}

export function skillLevelScope(snapshot: SkillSnapshot): string {
  return JSON.stringify([snapshot.learner_id, snapshot.target, snapshot.construct_registry_hash, snapshot.profile.choices.revision])
}

/** Owns celebrations for the active language. Mount once, in the shell. */
export function useSkillLevelEventQueue(snapshot: SkillSnapshot | null, reload: () => void, enabled = true): void {
  const target = snapshot?.target ?? null
  const scope = snapshot ? skillLevelScope(snapshot) : null
  const current = useRef({ scope, enabled, generation: 0 })
  if (current.current.scope !== scope || current.current.enabled !== enabled) current.current = { scope, enabled, generation: current.current.generation + 1 }
  const mounted = useRef(false)
  const failed = useRef<string | null>(null)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; current.current.generation++ } }, [])
  const showing = useSkillLevelEventStore(state => state.showing)
  const working = useSkillLevelEventStore(state => state.working)
  const initialized = useSkillLevelEventStore(state => state.initialized)

  // A language switch drops anything queued for the previous language.
  useEffect(() => { failed.current = null; useSkillLevelEventStore.setState({ initialized: null, showing: null, queue: [] }) }, [scope])

  useEffect(() => {
    if (!enabled || !snapshot || !scope || !target || working || showing) return
    // Hidden windows claim nothing; becoming visible reads evidence again.
    if (processed.has(snapshot) || !visible()) return
    const generation = current.current.generation
    const stillCurrent = () => mounted.current && current.current.enabled && current.current.scope === scope && current.current.generation === generation && visible()
    const signature = JSON.stringify([scope, snapshot.profile.pendingLevelEvents.map(event => event.id)])
    if (failed.current === signature) return
    const run = async (work: () => Promise<void>) => {
      processed.add(snapshot)
      useSkillLevelEventStore.setState({ working: true })
      // A failed or stale claim is reported and followed by a fresh read, never replayed.
      try { await work() } catch (error) {
        reportFault('Skill level celebrations', error)
        if (stillCurrent()) { failed.current = signature; reload() }
      } finally {
        if (!stillCurrent()) processed.delete(snapshot)
        useSkillLevelEventStore.setState({ working: false })
      }
    }
    if (initialized !== scope) {
      // Initialize before reading pending events, so catch-up and live steps come from one answer.
      void run(async () => {
        const pending = await initializeSkillLevelEvents(target)
        if (!stillCurrent()) return
        useSkillLevelEventStore.setState({ initialized: scope })
        await claimAndPresent(target, pending, stillCurrent, reload)
      })
      return
    }
    if (!snapshot.profile.pendingLevelEvents.length) return
    void run(() => claimAndPresent(target, snapshot.profile.pendingLevelEvents, stillCurrent, reload))
  }, [snapshot, scope, target, working, showing, initialized, reload, enabled])

  // Hidden windows do not consume celebrations; coming back reads the latest pending set.
  useEffect(() => {
    const again = () => { if (visible()) { failed.current = null; reload() } }
    document.addEventListener('visibilitychange', again)
    return () => document.removeEventListener('visibilitychange', again)
  }, [reload])

  // When a batch finishes, read evidence again for the next one.
  useEffect(() => useSkillLevelEventStore.subscribe((state, previous) => {
    if (previous.showing && !state.showing && !state.queue.length) reload()
  }), [reload])
}
