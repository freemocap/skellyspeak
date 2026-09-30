/** Offline visual fixture for the Practice tab with no cards: the empty layout
 * and the first-visit starter. `?starter=closed` shows the layout alone;
 * `?card=generated` shows one generated card with its "How this was added"
 * tip. `?ai` connects the AI pill and mounts the production AI View over a
 * conversation mid-turn, so its phone tray rises above Practice's recorder. Included sets use the actual Spanish language bank. Generation uses
 * fixed candidates. No microphone, provider or workspace writes. */
import { mockIPC } from '@tauri-apps/api/mocks'
import { parse } from 'yaml'
import spanishSource from '../../content/languages/spanish.yaml?raw'
import { createRoot } from 'react-dom/client'
import { loadLanguages } from '../src/platform/ipc/tauri'
import { useSettingsStore } from '../src/state/settings/settings'
import { I18nProvider } from '../src/components/localization/i18n'
import { ReadingLookupContext, type ReadingLookup } from '../src/components/reading/ReadingContext'
import { DrillPage } from '../src/features/drill/DrillPage'
import type { DrillCandidate, DrillGenerationPreview, DrillItemView, PracticeSet } from '../src/generated/contracts'
import { PREVIEW_SETTINGS } from './preview-settings'
import { AiViewPanel } from '../src/features/activity/AiViewPanel'
import { useNavigationStore } from '../src/state/navigation/navigation'
import { useSessionStore } from '../src/state/session/session'
import { useConnectionHealth } from '../src/state/session/connection-health'
import { AI_VIEW_CONVERSATION, aiViewCommand, presentTurn } from './ai-view-fixture'
import '../src/styles/index.css'

const query = new URLSearchParams(location.search)
document.documentElement.dataset.theme = query.get('theme') === 'dark' ? 'dark' : 'light'
const starter = query.get('starter')
const card = query.get('card')
const ai = query.has('ai')
const aiViewTurns = ai ? [presentTurn(14, 'live')] : []
const phraseSets = (parse(spanishSource) as { practice: { sets: Record<PracticeSet, string[]> } }).practice.sets

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
const TRANSLATIONS = ['Hello, how are you?', 'Good morning.', 'Good afternoon.', 'Good evening.', 'Goodbye.', 'See you later.', 'Please.', 'Thank you.']
const SOUNDS = ['ˈola ke ˈtal', 'ˈbwenos ˈdias', 'ˈbwenas ˈtaɾdes', 'ˈbwenas ˈnotʃes', 'aˈðjos', 'ˈasta ˈlweɣo', 'poɾ faˈβoɾ', 'ˈɡɾasjas']
const readFixture: ReadingLookup = async (input, signal) => {
  signal.throwIfAborted()
  const index = PHRASES.indexOf(input.text)
  if (index < 0) throw new Error('This reading fixture only covers the generated sample phrases.')
  return { translation: input.aid === 'translation' ? TRANSLATIONS[index] : null,
    gloss: input.aid === 'word_gloss' ? { coverage: 'complete', segments: [{start:0,end:input.text.length,kind:'gloss',gloss:TRANSLATIONS[index],pronunciation:SOUNDS[index]}] } : null,
    audioBase64:null,audioAlignment:null,explanations:null,receipt:null }
}
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
  const aiView = ai ? aiViewCommand(command, args, aiViewTurns) : undefined
  if (aiView !== undefined) return aiView
  if (command === 'list_microphones') return { source: 'native', devices: [] }
  if (command === 'get_snapshot') return { ...(ai ? { conversations: [AI_VIEW_CONVERSATION] } : {}), languages: [
    { id: 'spanish', name: 'Spanish', nativeName: 'Español', languageTag: 'es', transcriptionLanguage: 'es', fontScale: 1, direction: 'ltr', romanization: null, defaultVariety: 'spanish-mexico',
      greeting: { text: '¡Hola! ¿Cómo estás?', romanized: null }, partner: { name: 'Lucía', romanizedName: null, vibe: [] },
      varieties: [{ id: 'spanish-mexico', name: 'Mexico', description: 'Mexico', direction: 'ltr', fontScale: 1, romanization: null, transcriptionLanguage: 'es' }] },
  ] }
  if (command === 'get_drill_items') return cards
  if (command === 'get_practice_sets') return Object.entries(phraseSets).map(([set, phrases]) => ({ set, count: phrases.length, sample: phrases[0] }))
  if (command === 'preview_practice_set') {
    const set = (args as { set: PracticeSet }).set
    return { requestId: `bundled:${set}`, requested: null, receiptId: null, shortfall: null,
      candidates: phraseSets[set].map((text, index) => ({ candidateId: `bundled-${set}-${index}`, text, translation: null,
        reported: { difficulty: null, tags: [] }, verified: { scopeMatchesRequest: true, lengthOk: true, nonEmpty: true, duplicate: cards.some(card => card.text === text) },
        source: { kind: 'bundled', set, contentHash: 'fixture' } })) }
  }
  if (command === 'accept_practice_phrases') {
    const set = (args as { set: PracticeSet }).set
    const phrases = phraseSets[set]
    const ids = (args as { candidateIds: string[] }).candidateIds
    const kept = phrases.map((text, index) => ({ text, id: `bundled-${set}-${index}` }))
      .filter(entry => ids.includes(entry.id) && !cards.some(card => card.text === entry.text))
      .map(({ text, id }) => practiceCard(id, text, { kind: 'bundled', set, contentHash: 'fixture' }))
    cards = [...kept, ...cards]
    return kept
  }
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
if (ai) {
  useSessionStore.setState({ connection: { route: 'hosted', signedIn: true, email: '', revision: 1, configured: true, assessmentAdapter: 'jev_choice', standardModel: 'standard', fastModel: 'fast',
    audio: { transcription: { model: 'whisper-large-v3' }, speech: { model: 'openai/gpt-audio-mini' } }, paused: false } })
  useConnectionHealth.setState({ routes: { hosted: { revision: 1, status: 'connected', checkedAt: Date.now(), error: null } } })
}

/// The production AI View, opened by the AI pill as the app shell opens it.
function AiActivity() {
  const open = useNavigationStore(state => state.overlay === 'activity')
  return <AiViewPanel open={open} onOpenChange={next => next ? useNavigationStore.getState().showOverlay('activity') : useNavigationStore.getState().closeOverlay()} />
}

createRoot(document.getElementById('root')!).render(
  <I18nProvider locale="english">
    <ReadingLookupContext value={readFixture}><div className="app"><div className="content"><div className="page-holder"><DrillPage active /></div></div>{ai && <AiActivity />}</div></ReadingLookupContext>
  </I18nProvider>)
