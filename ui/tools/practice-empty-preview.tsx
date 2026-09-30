/** Offline visual fixture for the Practice tab with no cards: the empty layout
 * and the first-visit starter. `?starter=closed` shows the layout alone;
 * `?card=generated` shows one generated card with its "How this was added"
 * tip. Generate in Add practice cards, and every starter level, return the
 * same fixed phrases (one already a card), and keeping one adds it to the
 * fixture's list. No microphone, provider or workspace writes. */
import { mockIPC } from '@tauri-apps/api/mocks'
import { createRoot } from 'react-dom/client'
import { loadLanguages } from '../src/platform/ipc/tauri'
import { useSettingsStore } from '../src/state/settings/settings'
import { I18nProvider } from '../src/components/localization/i18n'
import { DrillPage } from '../src/features/drill/DrillPage'
import type { DrillCandidate, DrillGenerationPreview, DrillItemView } from '../src/generated/contracts'
import { PREVIEW_SETTINGS } from './preview-settings'
import '../src/styles/index.css'

const query = new URLSearchParams(location.search)
const starter = query.get('starter')
const card = query.get('card')

const scope = { language: 'spanish', variety: 'spanish-mexico', explanation: 'english', explanationVariety: 'english-united-states' }
const practiceCard = (id: string, text: string, source: DrillItemView['source']): DrillItemView => ({
  ...scope, id, text, source, createdAt: '2026-09-29T12:00:00.000Z', attemptCount: 0, bestMatchRatio: null, lastAttemptAt: null, attempts: [],
})
let cards: DrillItemView[] = card === 'generated'
  ? [practiceCard('fixture', 'Buenos días, ¿qué tal?', { kind: 'generated', requestId: 'fixture', candidateId: 'fixture', topic: null, difficulty: 'beginner', length: 'shortPhrase' })]
  : []

/// What every generation request returns. The last phrase is marked as already
/// a card, so the list shows both of a phrase's states.
const PHRASES = ['Hola, ¿qué tal?', 'Buenos días.', 'Buenas tardes.', 'Buenas noches.', 'Adiós.', 'Hasta luego.', 'Por favor.', 'Gracias.']
const candidates: DrillCandidate[] = PHRASES.map((text, index) => ({
  candidateId: `candidate-${index}`, text, translation: null, reported: { difficulty: 'beginner', tags: [] },
  verified: { scopeMatchesRequest: true, lengthOk: true, nonEmpty: true, duplicate: index === PHRASES.length - 1 },
  source: { kind: 'generated', requestId: 'fixture-request', candidateId: `candidate-${index}`, topic: null, difficulty: 'beginner', length: 'shortPhrase' },
}))
const preview: DrillGenerationPreview = {
  requestId: 'fixture-request', receiptId: null, shortfall: null, candidates,
  requested: { ...scope, topic: null, count: PHRASES.length, difficulty: 'beginner', length: 'shortPhrase' },
}

mockIPC((command, args) => {
  if (command === 'list_microphones') return { source: 'native', devices: [] }
  if (command === 'get_snapshot') return { languages: [
    { id: 'spanish', name: 'Spanish', nativeName: 'Español', languageTag: 'es', transcriptionLanguage: 'es', fontScale: 1, direction: 'ltr', romanization: null, defaultVariety: 'spanish-mexico',
      greeting: { text: '¡Hola! ¿Cómo estás?', romanized: null }, partner: { name: 'Lucía', romanizedName: null, vibe: [] },
      varieties: [{ id: 'spanish-mexico', name: 'Mexico', description: 'Mexico', direction: 'ltr', fontScale: 1, romanization: null, transcriptionLanguage: 'es' }] },
  ] }
  if (command === 'get_drill_items') return cards
  if (command === 'drill_attempts') return { attempts: [], nextCursor: null }
  if (command === 'start_drill_session') return 'fixture-session'
  if (command === 'enter_drill_visit') return 'fixture-visit'
  if (command === 'leave_drill_visit' || command === 'end_drill_session') return null
  if (command === 'get_cached_reading_audio') return null
  if (command === 'get_last_drill_item') return null
  if (command === 'get_learner_profile') return { evidence: { catalog: [] } }
  if (command === 'begin_drill_preview') return preview.requestId
  if (command === 'preview_drill_items') return preview
  if (command === 'accept_drill_items') {
    const ids = (args as { candidateIds: string[] }).candidateIds
    const kept = candidates.filter(entry => ids.includes(entry.candidateId)).map(entry => practiceCard(`kept-${entry.candidateId}`, entry.text, entry.source))
    cards = [...kept, ...cards]
    return kept
  }
  if (command === 'discard_drill_preview') return null
  if (command === 'record_frontend_diagnostic') return null
  throw new Error(`This offline fixture does not support ${command}.`)
})

if (starter === 'closed') localStorage.setItem('skellyspeak_practice_starter', 'closed')
else localStorage.removeItem('skellyspeak_practice_starter')
await loadLanguages()
useSettingsStore.setState({ settings: { ...PREVIEW_SETTINGS, target_variety: 'spanish-mexico', my_languages: ['spanish', 'english'] } })

createRoot(document.getElementById('root')!).render(
  <I18nProvider locale="english">
    <div className="app"><div className="content"><div className="page-holder"><DrillPage active /></div></div></div>
  </I18nProvider>)
