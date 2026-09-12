import { createContext, useEffect, useRef, useState } from 'react'
import { isTauri } from '../lib/tauri'
import { getSkillEvidence, saveLanguageProfile, subscribeSkillEvidence, type LanguageProfile, type SkillSnapshot } from '../lib/skills'

export interface LanguageProfileState {
  snapshot: SkillSnapshot | null
  error: string | null
  saving: boolean
  save: (choices: LanguageProfile) => Promise<void>
}
export const SkillEvidenceContext = createContext<LanguageProfileState>({
  snapshot: null, error: null, saving: false,
  save: async () => { throw new Error('Language profile provider is missing.') },
})

export function useSkillEvidence(active: boolean, settingsVersion: number) {
  const scope = useRef(settingsVersion)
  scope.current = settingsVersion
  const savePending = useRef(false)
  const [loaded, setLoaded] = useState<{ scope: number; snapshot: SkillSnapshot } | null>(null)
  const snapshot = loaded?.scope === settingsVersion ? loaded.snapshot : null
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!isTauri || !active) return
    let disposed = false
    let ticket = 0
    let inFlight = false
    let dirty = false
    let stop: (() => void) | undefined
    setError(null)
    const refresh = () => {
      if (disposed) return
      if (inFlight) { dirty = true; return }
      inFlight = true
      const request = ++ticket
      void getSkillEvidence().then((value) => {
        if (!disposed && request === ticket) {
          setLoaded(current => current?.scope === settingsVersion && current.snapshot.target === value.target && current.snapshot.profile.choices.revision > value.profile.choices.revision ? current : { scope: settingsVersion, snapshot: value })
          setError(null)
        }
      }).catch((failure: unknown) => { if (!disposed && request === ticket) setError(String(failure)) }).finally(() => {
        inFlight = false
        if (dirty && !disposed) { dirty = false; refresh() }
      })
    }
    void subscribeSkillEvidence(refresh).then((unsubscribe) => {
      if (disposed) unsubscribe()
      else { stop = unsubscribe; refresh() }
    }).catch((failure: unknown) => { if (!disposed) setError(String(failure)) })
    return () => { disposed = true; stop?.() }
  }, [active, settingsVersion, revision])
  const [saving, setSaving] = useState(false)
  const save = async (choices: LanguageProfile) => {
    if (savePending.current) throw new Error('A language profile save is already in progress.')
    if (!snapshot || snapshot.target !== choices.target || snapshot.profile.choices.learner_id !== choices.learner_id) throw new Error('The language profile is not ready for this edit.')
    const owner = settingsVersion
    savePending.current = true
    setSaving(true)
    try {
      const result = await saveLanguageProfile(choices)
      if (result.target !== choices.target || result.profile.choices.learner_id !== choices.learner_id) throw new Error('Saved language profile has unexpected ownership.')
      if (scope.current === owner) {
        setLoaded(current => current?.scope === owner && current.snapshot.profile.choices.revision > result.profile.choices.revision ? current : { scope: owner, snapshot: result })
      }
    } finally {
      savePending.current = false
      setSaving(false)
      if (scope.current === owner) setRevision((value) => value + 1)
    }
  }
  return { snapshot, error, saving, save, refresh: () => setRevision((value) => value + 1) }
}
