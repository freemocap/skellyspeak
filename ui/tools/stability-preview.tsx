/** Layout-stability review: one exchange at each moment of its life, side by
 *  side, with each moment's measured height. Production components and sample
 *  data only; no native or AI calls. A stable layout shows equal heights. */
import { mockIPC } from '@tauri-apps/api/mocks'
import { loadLanguages } from '../src/platform/ipc/tauri'
import { createRoot } from 'react-dom/client'
import { useLayoutEffect, useRef, useState } from 'react'
import { TurnView, type TurnShape } from '../src/features/conversation/messages/TurnView'
import { MessageReadingScope } from '../src/features/conversation/reading/MessageReadingScope'
import { ReadingProvider } from '../src/components/reading/TargetText'
import { ReadingPreferencesContext } from '../src/components/reading/ReadingPreferences'
import { useAppearance } from '../src/platform/appearance/useAppearance'
import { PREVIEW_SETTINGS } from './preview-settings'
import { DEFAULT_APPEARANCE } from '../src/generated/contracts'
import type { ConversationFeedback, TurnView as Execution } from '../src/generated/contracts'
import '../src/styles/index.css'

const languages = [
  { transcriptionLanguage: 'es', languageTag: 'es', fontScale: 1, id: 'spanish', name: 'Spanish', nativeName: 'Español', direction: 'ltr', romanization: null, defaultVariety: 'spanish-spain',
    varieties: [{ transcriptionLanguage: 'es', id: 'spanish-spain', name: 'Spain', description: 'Spain', direction: 'ltr', fontScale: 1, romanization: null }] },
  { transcriptionLanguage: 'en', languageTag: 'en', fontScale: 1, id: 'english', name: 'English', nativeName: 'English', direction: 'ltr', romanization: null, defaultVariety: 'english-united-states',
    varieties: [{ transcriptionLanguage: 'en', id: 'english-united-states', name: 'United States', description: 'United States', direction: 'ltr', fontScale: 1, romanization: null }] },
]
mockIPC(command => {
  if (command === 'get_snapshot') return { languages } as unknown
  throw new Error('This layout preview does not support native actions.')
})
await loadLanguages()

const user = 'Fui a la playa con mi hermana.'
const reply = '¡Qué bien! ¿Hacía calor en la playa?'
const token = (text: string, gloss: string) => ({ text, gloss, pos: null, notable: false, romanization: null, pronunciation: null })
const replyTokens = [token('¡Qué', 'How'), token('bien!', 'nice!'), token('¿Hacía', 'Was it'), token('calor', 'hot'), token('en', 'at'), token('la', 'the'), token('playa?', 'beach?')]
const userTokens = [token('Fui', 'I went'), token('a', 'to'), token('la', 'the'), token('playa', 'beach'), token('con', 'with'), token('mi', 'my'), token('hermana.', 'sister.')]
const feedback = { remark: 'Clear.', usedTarget: [], usedNative: [], grammar: 5, conversation: 4, corrections: [] } as unknown as ConversationFeedback
const execution = (reply: string, glossing: string, partial?: string): Execution => ({
  id: 'turn', state: reply === 'succeeded' && glossing === 'succeeded' ? 'succeeded' : 'assisting', paused: false, hold: null,
  operations: [{ id: 'reply', kind: 'persona_reply', state: reply }, { id: 'gloss', kind: 'word_gloss', state: glossing }],
  attempts: [{ id: 'attempt', operationId: 'reply', state: reply, unpublishedText: partial ?? null }],
} as unknown as Execution)
const assistant = (translation: string | null, translationState: string, glossState: string) => ({
  reply, tokens: replyTokens, user_tokens: userTokens, translation, user_translation: null, mechanics: [], errors: [],
  scaffolds: { replies: [], frames: [], starters: [] }, translationState, glossState,
})
const moments: { label: string; turn: TurnShape; reviewing: boolean }[] = [
  { label: 'Sent', reviewing: true, turn: { id: 1, user, pendingText: '', assistant: null, userTranslationState: 'running', execution: execution('running', 'waiting_dependencies'), replyState: { state: 'pending', error: null, control: null } } },
  { label: 'Streaming', reviewing: true, turn: { id: 1, user, pendingText: '', assistant: null, userTranslationState: 'running', execution: execution('running', 'waiting_dependencies', '¡Qué bien! ¿Hacía calor'), replyState: { state: 'pending', error: null, control: null } } },
  { label: 'Reply landed', reviewing: true, turn: { id: 1, user, pendingText: '', assistant: assistant(null, 'running', 'running') as never, userTranslation: 'I went to the beach with my sister.', userTranslationState: 'succeeded', execution: execution('succeeded', 'running') } },
  { label: 'Settled', reviewing: false, turn: { id: 1, user, pendingText: '', assistant: assistant('How nice! Was it hot at the beach?', 'succeeded', 'succeeded') as never, userTranslation: 'I went to the beach with my sister.', userTranslationState: 'succeeded', conversationFeedback: feedback, reaction: { kind: 'curious', interpretation: 'Interested.', explanation: 'Asked a follow-up.' }, execution: execution('succeeded', 'succeeded') } },
]

function Moment({ label, turn, reviewing }: typeof moments[number]) {
  const stack = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)
  useLayoutEffect(() => {
    const node = stack.current
    if (!node) return
    const observer = new ResizeObserver(() => setHeight(Math.round(node.getBoundingClientRect().height)))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return <section className="chat" data-moment={label} style={{ width: 420, flex: 'none', height: 'auto' }}>
    <h2 style={{ margin: 0, padding: 'var(--space-4) var(--space-6)', font: 'var(--weight-semibold) var(--type-ui) var(--font-sans)' }}>{label} · <span data-height>{height}</span> px</h2>
    <div className="stream" style={{ overflow: 'visible' }}>
      <div ref={stack}>
        <MessageReadingScope scope={{ language: 'spanish', variety: 'spanish-spain', explanation: 'english', explanationVariety: 'english-united-states' }}>
          <TurnView turn={turn} reviewing={reviewing} onAskCoach={() => {}} focused={false} ttsReady speaking={false} rtl={false} onBubbleTap={() => {}} onSpeak={() => {}} onEditUser={() => {}} onActivity={() => {}} />
        </MessageReadingScope>
      </div>
    </div>
  </section>
}

function Preview() {
  const [autoTranslate, setAutoTranslate] = useState(true)
  useAppearance({ ...PREVIEW_SETTINGS, appearance: DEFAULT_APPEARANCE })
  return <ReadingProvider settings={null}><ReadingPreferencesContext value={{ autoTranslate, alwaysRomanize: false, alwaysPronunciation: false, supportsRomanization: false }}>
    <main style={{ padding: 'var(--space-8)', display: 'grid', gap: 'var(--space-6)', background: 'var(--bg)', minHeight: '100vh' }}>
      <label style={{ font: 'var(--type-ui) var(--font-sans)' }}><input type="checkbox" checked={autoTranslate} onChange={event => setAutoTranslate(event.target.checked)} /> Auto-translate</label>
      <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'flex-start', overflowX: 'auto' }}>
        {moments.map(moment => <Moment key={moment.label} {...moment} />)}
      </div>
    </main>
  </ReadingPreferencesContext></ReadingProvider>
}
createRoot(document.getElementById('root')!).render(<Preview />)
