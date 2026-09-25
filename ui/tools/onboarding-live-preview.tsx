/** Review surface for the REAL OnboardingSetup, not a redrawing of it.
 *
 * Session-only fixtures: the language catalog and preference record are sample
 * data, and every native action throws. Nothing here persists or calls AI.
 */
import { Tour } from '../src/app/tour/Tour'
import { mockIPC } from '@tauri-apps/api/mocks'
import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import { I18nProvider } from '../src/components/localization/i18n'
import { OnboardingSetup } from '../src/features/settings/onboarding/OnboardingSetup'
import { useOnboardingStore } from '../src/state/settings/onboarding'
import { useSessionStore } from '../src/state/session/session'
import { loadLanguages } from '../src/platform/ipc/tauri'
import { useAppearance } from '../src/platform/appearance/useAppearance'
import { DEFAULT_APPEARANCE, type ConnectionConfig, type Preferences } from '../src/generated/contracts'
import { PREVIEW_SETTINGS } from './preview-settings'
import '../src/styles/index.css'

/** The real bundled catalog, trimmed to the fields the projection carries. */
const CATALOG = [
  ['arabic', 'Arabic', 'العربية', 'ar', 'rtl', 1.5, 'مرحبا', 'نور', 'Nūr', '🏛️'],
  ['english', 'English', 'English', 'en', 'ltr', 1, 'hello', 'Rowan', null, '📚'],
  ['french', 'French', 'Français', 'fr', 'ltr', 1, 'bonjour', 'Camille', null, '🎨'],
  ['german', 'German', 'Deutsch', 'de', 'ltr', 1, 'hallo', 'Jonas', null, '🚴'],
  ['hindi', 'Hindi', 'हिन्दी', 'hi', 'ltr', 1, 'नमस्ते', 'आशा', 'Āshā', '🪔'],
  ['irish', 'Irish', 'Gaeilge', 'ga', 'ltr', 1, 'dia duit', 'Nóra', null, '🌱'],
  ['italian', 'Italian', 'Italiano', 'it', 'ltr', 1, 'ciao', 'Elena', null, '🍋'],
  ['malayalam', 'Malayalam', 'മലയാളം', 'ml', 'ltr', 1, 'നമസ്കാരം', 'മീന', 'Mīna', '🌴'],
  ['mandarin', 'Mandarin', '中文（简体）', 'zh', 'ltr', 1.3, '你好', '小林', 'Xiǎo Lín', '🚲'],
  ['portuguese', 'Portuguese', 'Português', 'pt', 'ltr', 1, 'olá', 'Marina', null, '🌊'],
  ['scottish-gaelic', 'Scottish Gaelic', 'Gàidhlig', 'gd', 'ltr', 1, 'halò', 'Màiri', null, '🏔️'],
  ['spanish', 'Spanish', 'Español', 'es', 'ltr', 1, 'hola', 'Lucía', null, '🌿'],
] as const

/** The real variety ids and names from `content/languages/`, trimmed to the
 * languages this preview's CATALOG covers. */
const VARIETIES: Record<string, [id: string, name: string][]> = {
  arabic: [['arabic-levantine', 'Levantine'], ['arabic-modern-standard', 'Modern Standard']],
  english: [['english-united-states', 'United States'], ['english-united-kingdom', 'United Kingdom']],
  french: [['french-france', 'France'], ['french-canada', 'Canada']],
  german: [['german-germany', 'Germany']],
  hindi: [['hindi-india', 'India']],
  irish: [['irish-ireland', 'Ireland']],
  italian: [['italian-italy', 'Italy']],
  malayalam: [['malayalam-kerala', 'Kerala']],
  mandarin: [['mandarin-mainland-china', 'Mainland China']],
  portuguese: [['portuguese-brazil', 'Brazil']],
  'scottish-gaelic': [['scottish-gaelic-scotland', 'Scotland']],
  spanish: [['spanish-spain', 'Spain'], ['spanish-mexico', 'Mexico']],
}

const languages = CATALOG.map(([id, name, nativeName, tag, direction, fontScale, greeting, partner, romanized, vibe]) => {
  const varieties = VARIETIES[id]
  if (!varieties) throw new Error(`No varieties defined for preview language "${id}".`)
  return {
    transcriptionLanguage: tag, languageTag: tag, fontScale, direction, romanization: null,
    id, name, nativeName, defaultVariety: varieties[0][0],
    greeting: { text: greeting, romanized: null },
    partner: { name: partner, romanizedName: romanized, vibe: [vibe] },
    varieties: varieties.map(([varietyId, label]) => ({
      transcriptionLanguage: tag, id: varietyId, name: label, description: label,
      direction, fontScale, romanization: null,
    })),
  }
})

mockIPC((command) => {
  if (command === 'get_snapshot') return { languages } as unknown
  throw new Error('This onboarding preview does not support native actions.')
})
await loadLanguages()

const preferences: Preferences = {
  theme: 'light', appearance: { ...DEFAULT_APPEARANCE }, textSize: 85, textSpacing: 0, highContrast: false,
  interfaceLocale: 'english', explanationLanguage: 'english', explanationVarietyId: 'english-united-states',
  myLanguages: [], targetVarieties: {}, onboarding: 'not_started', onboardingRequired: true,
  onboardingLanguage: null, onboardingHelp: false,
}

function Preview() {
  const [dark, setDark] = useState(false)
  const [step, setStep] = useState<'not_started' | 'in_progress'>('not_started')
  const [connected, setConnected] = useState(false)
  const [tourOpen, setTourOpen] = useState(false)
  useAppearance({ ...PREVIEW_SETTINGS, theme: dark ? 'dark' : 'light' })
  useOnboardingStore.setState({
    preferences: { ...preferences, onboarding: step, onboardingHelp: tourOpen }, busy: false,
    saveLanguages: async (...values) => { console.log('saveLanguages', values); setStep('in_progress') },
    finish: async skip => { console.log('finish', skip); setTourOpen(true) },
    showHelp: async show => setTourOpen(show),
    back: async () => setStep('not_started'),
  })
  useSessionStore.setState({ connection: { configured: connected } as ConnectionConfig })
  return <>
    <div style={{ position: 'fixed', zIndex: 99, insetInlineStart: 0, insetBlockStart: 0, display: 'flex', gap: '12px', padding: '8px 12px', background: 'var(--chrome)', fontSize: '13px' }}>
      <strong>Live fixture · sample data · no AI</strong>
      <label><input type="checkbox" checked={step === 'in_progress'} onChange={event => setStep(event.target.checked ? 'in_progress' : 'not_started')} /> Step 2</label>
      <label><input type="checkbox" checked={connected} onChange={event => setConnected(event.target.checked)} /> Connected</label>
      <label><input type="checkbox" checked={tourOpen} onChange={event => setTourOpen(event.target.checked)} /> Tour</label>
      <label><input type="checkbox" checked={dark} onChange={event => setDark(event.target.checked)} /> Dark</label>
    </div>
    <div style={{ paddingBlockStart: '36px', height: '100%' }}>
      <I18nProvider locale="english"><OnboardingSetup />{tourOpen && <Tour />}</I18nProvider>
    </div>
  </>
}

createRoot(document.getElementById('root')!).render(<Preview />)
