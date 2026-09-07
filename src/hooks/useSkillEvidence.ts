import { createContext, useEffect, useState } from 'react'
import { isTauri } from '../lib/tauri'
import { getSkillEvidence, saveSkillProfile, subscribeSkillEvidence, type ProfileChoices, type SkillSnapshot } from '../lib/skills'

export const SkillEvidenceContext = createContext<{ snapshot: SkillSnapshot | null; error: string | null }>({ snapshot: null, error: null })

export function useSkillEvidence(active: boolean, settingsVersion: number) {
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
        if (!disposed && request === ticket) { setLoaded({ scope: settingsVersion, snapshot: value }); setError(null) }
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
  const save = async (choices: ProfileChoices) => {
    setSaving(true)
    try {
      await saveSkillProfile(choices)
      setRevision((value) => value + 1)
    } finally { setSaving(false) }
  }
  return { snapshot, error, saving, save, refresh: () => setRevision((value) => value + 1) }
}
