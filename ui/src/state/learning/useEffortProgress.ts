import { useEffect, useState } from 'react'
import type { EffortProgress } from '../../generated/contracts'
import { getEffortProgress, claimEffortAwards } from '../../platform/ipc/effort'
import { onRecordingPublished } from '../../platform/audio/recording-events'
import { useSettingsStore } from '../settings/settings'
import { errorMessage } from '../../platform/diagnostics/error-details'

/** Source publication drives refresh; reads never award credit. */
export function useEffortProgress(target: string, revision: unknown, present = true) {
  const effects = useSettingsStore(state => state.settings?.xp_effects !== false)
  const [recording, setRecording] = useState(0)
  const [state, setState] = useState<{ target: string; value: EffortProgress | null; error: string | null; arrived: string[] }>({ target, value: null, error: null, arrived: [] })
  useEffect(() => onRecordingPublished(() => setRecording(value => value + 1)), [])
  useEffect(() => {
    if (!target) return
    let current = true
    void getEffortProgress(target).then(async value => {
      if (!current) return
      const ids = value.recent.filter(award => !award.claimed).map(award => award.id)
      let claimed: string[] = []
      let error: string | null = null
      try { claimed = present && ids.length ? await claimEffortAwards(target, ids) : [] }
      catch (failure) { error = errorMessage(failure) }
      if (!current) return
      setState(previous => ({ target, value, error, arrived: previous.target === target && previous.value ? claimed : [] }))
    }).catch(error => { if (current) setState({ target, value: null, error: errorMessage(error), arrived: [] }) })
    return () => { current = false }
  }, [target, revision, recording, present])
  return { ...(state.target === target ? state : { target, value: null, error: null, arrived: [] }), effects }
}

/** One conversation's effort counts. Read-only: the shell's language read owns
 * presentation claims, and its value is passed as `revision` so new awards refresh this. */
export function useConversationEffort(target: string, conversation: string | null, revision: unknown) {
  const [state, setState] = useState<{ key: string; value: EffortProgress | null; error: string | null }>({ key: '', value: null, error: null })
  const key = `${target}|${conversation ?? ''}`
  useEffect(() => {
    if (!target || !conversation) return
    let current = true
    void getEffortProgress(target, conversation)
      .then(value => { if (current) setState({ key, value, error: null }) })
      .catch(error => { if (current) setState({ key, value: null, error: errorMessage(error) }) })
    return () => { current = false }
  }, [key, target, conversation, revision])
  return state.key === key ? state : { key, value: null, error: null }
}
