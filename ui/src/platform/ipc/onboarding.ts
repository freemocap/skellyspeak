import { invoke } from './native'
import type { Preferences } from '../../generated/contracts'
import { executeAction, readWorkspace } from './workspace'

/** Use a fresh revision and preserve unrelated preferences. Never retry a failed write. */
export async function updateOnboarding(change: (current: Preferences) => Preferences): Promise<Preferences> {
  const snapshot = await readWorkspace()
  const { learner } = snapshot
  const preferences = change(learner.preferences)
  await executeAction(snapshot, {
    kind: 'updateLearner', name: learner.name, expectedRevision: learner.revision, preferences,
  })
  return (await readWorkspace()).learner.preferences
}

export function deviceLanguages(): Promise<string[]> { return invoke('preferred_languages') }
