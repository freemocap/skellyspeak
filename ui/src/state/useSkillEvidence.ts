import { createContext, useEffect } from 'react'
import { useSettingsStore } from './settings'
import { useSkillEvidenceStore, type SkillEvidenceState } from './skill-evidence'
import type { SkillSnapshot } from '../domain/skills/skills'

/// The evidence a **subtree** shows.
///
/// This stays a context rather than becoming a store read everywhere, because a
/// surface may present a different snapshot to its own subtree: the profile
/// overlay passes a global one. Components inside it must see that snapshot, not
/// the app-level one the store holds.
export const SkillEvidenceContext = createContext<{ snapshot: SkillSnapshot | null; error: string | null }>({ snapshot: null, error: null })

/// The snapshot to show for `target` at `revision`, or null when there is none
/// to show.
///
/// One rule, in one place: evidence read for another language, or read under a
/// settings revision that no longer applies, describes something the learner is
/// not looking at, and is hidden until the read that answers this one lands.
export function selectSkillSnapshot(state: SkillEvidenceState, target: string | undefined, revision: number): SkillSnapshot | null {
  const snapshot = state.snapshot
  return target && snapshot?.target === target && state.scope === revision ? snapshot : null
}

/// Keep evidence read for the active language at the current settings revision.
///
/// The read belongs to the store, so this only has to say what is wanted. It is
/// idempotent, so the shell can own it without a surface that reads evidence
/// early causing a second request.
export function useLoadSkillEvidence(): void {
  const target = useSettingsStore((state) => state.settings?.target_language)
  const revision = useSettingsStore((state) => state.revision)
  useEffect(() => { if (target) useSkillEvidenceStore.getState().load(target, revision) }, [target, revision])
}

/// The evidence the surfaces show, and the two actions that change it.
///
/// Read-only on purpose: keeping evidence read belongs to the shell, which calls
/// `useLoadSkillEvidence` once. A surface that shows evidence must not be what
/// decides to fetch it.
export function useSkillEvidence() {
  const target = useSettingsStore((state) => state.settings?.target_language)
  const revision = useSettingsStore((state) => state.revision)
  const snapshot = useSkillEvidenceStore((state) => selectSkillSnapshot(state, target, revision))
  const error = useSkillEvidenceStore((state) => state.error)
  const saving = useSkillEvidenceStore((state) => state.saving)
  const save = useSkillEvidenceStore((state) => state.save)
  const reload = useSkillEvidenceStore((state) => state.reload)
  return { snapshot, error, saving, save, reload }
}
