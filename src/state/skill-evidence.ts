import { create } from 'zustand'
import { getSkillEvidence, saveSkillProfile } from '../platform/skill-evidence'
import type { ProfileChoices, SkillSnapshot } from '../domain/skills/skills'

/// Skill evidence, as one value the whole app reads.
///
/// Evidence moves when the conversation advances, so whoever sees the
/// conversation change asks for a reload. Callers are direct: nothing has to be
/// listening for the change, and nothing has to unsubscribe.

export interface SkillEvidenceState {
  snapshot: SkillSnapshot | null
  /// The settings revision the snapshot was read at. A snapshot read at another
  /// revision was read for settings that no longer apply.
  scope: number
  error: string | null
  saving: boolean

  /// Read evidence for a language at a settings revision. Reading what the store
  /// already has, or is already reading, does nothing, which is what makes it
  /// safe for every surface that shows evidence to call it.
  load: (target: string, revision: number) => void
  /// Read again for the language and revision the store last worked on.
  reload: () => void
  /// Save the profile choices and read again, because the choices are what the
  /// evidence is computed from. A failure reaches the caller, which shows it
  /// where the learner made the change.
  save: (choices: ProfileChoices) => Promise<void>
}

const initialState = {
  snapshot: null as SkillSnapshot | null,
  scope: 0,
  error: null as string | null,
  saving: false,
}

/// One read: which language, at which settings revision, and which attempt it is.
type Read = { id: number; target: string; revision: number }

export const useSkillEvidenceStore = create<SkillEvidenceState>((set, get) => {
  /// Read bookkeeping, deliberately not store state: nothing renders it, and it
  /// has to outlive a failed read so that a retry re-reads what failed.
  /// `id` identifies an attempt, so the answer to a superseded read — a slower one,
  /// or one for a language the learner has left — cannot land on top of a newer
  /// answer.
  let read: Read = { id: 0, target: '', revision: 0 }
  let inFlight: Read | null = null
  /// A read of the current request was asked for while one was in flight, so it
  /// runs when that one settles. At most one trailing read: a burst of reloads
  /// must not become a burst of requests, and the last one must still land.
  let queued = false

  const start = (next: Read) => {
    read = next
    inFlight = next
    void getSkillEvidence(next.target).then((value) => {
      if (read.id === next.id) set({ snapshot: value, scope: next.revision, error: null })
    }).catch((failure: unknown) => {
      if (read.id === next.id) set({ error: String(failure) })
    }).finally(() => {
      if (inFlight?.id === next.id) inFlight = null
      if (queued) { queued = false; start(read) }
    })
  }

  return {
    ...initialState,

    load: (target, revision) => {
      // Already showing it, or already being read: a second read would put the
      // same question to the core twice.
      if (get().snapshot?.target === target && get().scope === revision) return
      if (inFlight?.target === target && inFlight.revision === revision) return
      start({ id: read.id + 1, target, revision })
    },

    reload: () => {
      if (read.id === 0) return
      const next = { ...read, id: read.id + 1 }
      // A read is in flight: one more runs when it settles, rather than asking
      // twice at once.
      if (inFlight) { read = next; queued = true; return }
      start(next)
    },

    save: async (choices) => {
      set({ saving: true })
      try {
        await saveSkillProfile(choices)
      } finally {
        set({ saving: false })
      }
      get().reload()
    },
  }
})
