import { executeAction, readWorkspace, selectedConversation } from './workspace'

/** Only learner preferences change. Adding never creates or opens a conversation. */
export async function saveMyLanguage(language: string, variety: string | null): Promise<void> {
  const snapshot = await readWorkspace()
  const active = selectedConversation(snapshot)?.languageId
  const learner = snapshot.learner
  const definition = snapshot.languages.find(item => item.id === language)
  if (!definition) throw new Error('The selected language is unavailable.')
  if (variety !== null && !definition.varieties.some(item => item.id === variety)) throw new Error('The selected variety is unavailable.')
  if (variety === null && language === active) throw new Error('Switch languages before removing the current language.')
  // Persist the active shortcut too, so adding a second language retains the first.
  const current = [...new Set([...learner.preferences.myLanguages, ...(active ? [active] : [])])]
  const myLanguages = variety === null ? current.filter(item => item !== language) : [...new Set([...current, language])]
  const targetVarieties = variety === null ? learner.preferences.targetVarieties : { ...learner.preferences.targetVarieties, [language]: variety }
  await executeAction(snapshot, {
    kind: 'updateLearner', expectedRevision: learner.revision, name: learner.name,
    preferences: { ...learner.preferences, myLanguages, targetVarieties },
  })
}
