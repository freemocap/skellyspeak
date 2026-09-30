/** Deterministic production-component transitions. No native or provider calls. */
import { createRoot } from 'react-dom/client'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ReadingPreferencesContext } from '../src/components/reading/ReadingPreferences'
import { PendingTurn } from '../src/features/conversation/messages/PendingTurn'
import { TurnView, type TurnShape } from '../src/features/conversation/messages/TurnView'
import { useConversationScroll } from '../src/features/conversation/messages/useConversationScroll'
import type { PendingMessage } from '../src/features/conversation/session/usePendingMessage'
import { useAttemptStreams } from '../src/state/session/attempt-streams'
import '../src/styles/index.css'

const phases = ['Before send', 'Submitting', 'Saved · aids queued', 'Reply delivery', 'Reply received · aids queued', 'Reply aids running', 'Complete', 'Rejected'] as const
const longReply = 'Tell me about the market. What did you find there, which stalls did you visit, and what would you like to buy next time?'
const samples = [
  { name: 'Latin', text: 'Ayer fui al mercado.', original: 'Ayer fue al mercado.', reply: '¿Qué compraste en el mercado?', rtl: false,
    words: ['Ayer', 'fui', 'al', 'mercado.'], meanings: ['yesterday', 'I went', 'to the', 'market'],
    replyWords: ['¿Qué', 'compraste', 'en', 'el', 'mercado?'], replyMeanings: ['what', 'you bought', 'in', 'the', 'market'] },
  { name: 'Mixed scripts', text: 'البيوت cafe\u0301 中文', original: 'البيوت café 中文', reply: '中文 cafe\u0301 البيوت', rtl: true,
    words: ['البيوت', 'cafe\u0301', '中文'], meanings: ['the houses', 'coffee', 'Chinese'],
    replyWords: ['中文', 'cafe\u0301', 'البيوت'], replyMeanings: ['Chinese', 'coffee', 'the houses'] },
  { name: 'Long reply', text: 'I went to the market.', original: 'I go to the market.', reply: longReply, rtl: false,
    words: ['I', 'went', 'to', 'the', 'market.'], meanings: ['I', 'went', 'to', 'the', 'market'],
    replyWords: longReply.split(' '), replyMeanings: longReply.split(' ') },
]
const noop = () => {}
function Fixture() {
  const [phase, setPhase] = useState(0)
  const [mode, setMode] = useState('edit')
  const [sampleIndex, setSampleIndex] = useState(0)
  const [aids, setAids] = useState(true)
  const [sound, setSound] = useState(false)
  const [width, setWidth] = useState(900)
  const [scale, setScale] = useState(1)
  const [delay, setDelay] = useState(1000)
  const [running, setRunning] = useState(false)
  const [delivery, setDelivery] = useState('stream')
  useEffect(() => {
    if (!running || phase >= 6) { setRunning(false); return }
    const timer = setTimeout(() => setPhase(value => value + 1), delay)
    return () => clearTimeout(timer)
  }, [phase, delay, running])
  const sample = samples[sampleIndex]
  useEffect(() => {
    useAttemptStreams.getState().reset()
    if (phase !== 3 || delivery !== 'stream') return
    const pieces = [...new Intl.Segmenter(undefined, { granularity: 'word' }).segment(sample.reply)]
    let index = 0
    const timer = setInterval(() => {
      const part = pieces[index++]
      if (!part) { clearInterval(timer); return }
      useAttemptStreams.getState().apply({ generation: 1, conversationId: 'fixture', turnId: 'reply-turn', operationId: 'reply-operation',
        attemptId: 'reply-attempt', kind: 'persona_reply', seq: index, text: sample.reply.slice(0, part.index + part.segment.length), terminal: null })
    }, 120)
    return () => clearInterval(timer)
  }, [phase, delivery, sample])
  const editing = mode === 'edit' && (phase <= 1 || phase === 7)
  const working = phase === 1
  const ready = phase === 6 || phase === 0 || phase === 7
  const replyReady = phase >= 4 || phase === 0
  const state = phase === 2 || phase === 4 ? 'ready' : phase === 3 || phase === 5 ? 'running' : 'succeeded'
  const tokens = (words: string[], meanings: string[]) => words.map((text, index) => ({ text, gloss: meanings[index], romanization: null,
    pronunciation: text, pos: null, notable: false }))
  const turn: TurnShape = {
    id: 1, turnId: phase < 2 || phase === 7 ? 'original' : 'accepted',
    replacesTurnId: mode === 'edit' && phase >= 2 && phase !== 7 ? 'original' : null,
    user: editing ? sample.original : sample.text, pendingText: '', userGlossState: state, userTranslationState: state,
    replyState: { state: 'pending', error: null, control: null },
    execution: { id: 'reply-turn', state: replyReady ? 'succeeded' : 'pending', paused: false, route: 'hosted', hold: null, replacesTurnId: null, replacedBy: null,
      operations: [{ id: 'reply-operation', kind: 'persona_reply', state: replyReady ? 'succeeded' : 'running', role: 'standard', contractVersion: 1, dependencies: [], sourceMessageId: null }],
      attempts: [{ id: 'reply-attempt', operationId: 'reply-operation', state: replyReady ? 'succeeded' : 'running', requestedModel: 'fixture', actualModel: null, providerId: null,
        startedAt: '', finishedAt: null, inputTokens: null, outputTokens: null, error: null, diagnostics: null, unpublishedText: null }],
    },
    assistant: replyReady ? {
      reply: sample.reply, tokens: ready ? tokens(sample.replyWords, sample.replyMeanings) : [],
      user_tokens: ready ? tokens(editing ? sample.original.split(' ') : sample.words, sample.meanings) : [],
      translation: ready ? 'The partner asks a question about the previous message.' : '',
      user_translation: ready ? 'A sample translation, with enough words to wrap on a narrow screen.' : '',
      glossState: state, translationState: state, mechanics: [], errors: [], scaffolds: { replies: [], frames: [], starters: [] },
    } : null,
  }
  const pending: PendingMessage = { key: 'submitted', editing: mode === 'edit' ? { id: 1, turnId: 'original' } : null,
    text: mode === 'voice' ? null : sample.text, phase: mode === 'voice' ? 'transcribing' : 'sending', known: new Set(), failure: null, retry: null }
  const stream = useRef<HTMLDivElement>(null)
  const scroll = useConversationScroll(stream, 'fixture', 1, phase, `phase:${phase}`)
  const container = { height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', '--reading-scale': scale } as CSSProperties
  return <ReadingPreferencesContext value={{ autoTranslate: aids, alwaysRomanize: false, alwaysPronunciation: sound, supportsRomanization: true }}>
    <div style={container}>
      <div style={{ padding: 12, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <strong>Transition fixture · sample data only</strong>
        <label>Action <select value={mode} onChange={event => { setMode(event.target.value); setPhase(0); setRunning(false) }}>
          <option value="edit">Edit</option><option value="send">Send</option><option value="voice">Transcribe and send</option>
        </select></label>
        <label>Delivery <select value={delivery} onChange={event => setDelivery(event.target.value)}><option value="stream">Streamed chunks</option><option value="batch">Whole response</option></select></label>
        <label>Stage <select value={phase} onChange={event => { setPhase(Number(event.target.value)); setRunning(false) }}>
          {phases.map((label, index) => <option key={label} value={index}>{label}</option>)}
        </select></label>
        <label>Delay <select value={delay} onChange={event => setDelay(Number(event.target.value))}>
          {[100, 1000, 4000, 8000].map(value => <option key={value} value={value}>{value} ms</option>)}
        </select></label>
        <button onClick={() => { setPhase(1); setRunning(true) }}>Run transitions</button>
        <button onClick={() => setRunning(false)}>Pause</button>
        <label>Text <select value={sampleIndex} onChange={event => setSampleIndex(Number(event.target.value))}>
          {samples.map((value, index) => <option key={value.name} value={index}>{value.name}</option>)}
        </select></label>
        <label>Width <select value={width} onChange={event => setWidth(Number(event.target.value))}><option value={900}>Wide</option><option value={390}>Narrow</option></select></label>
        <label>Reading size <select value={scale} onChange={event => setScale(Number(event.target.value))}><option value={1}>100%</option><option value={1.5}>150%</option></select></label>
        <label><input type="checkbox" checked={aids} onChange={event => setAids(event.target.checked)} />Translations</label>
        <label><input type="checkbox" checked={sound} onChange={event => setSound(event.target.checked)} />Pronunciation</label>
      </div>
      <section key={`${mode}:${sampleIndex}`} className="chat" style={{ width, maxWidth: '100%' }}>
        <div className="stream" ref={stream} onScroll={scroll.onScroll} data-editing={editing ? '' : undefined}>
          {mode !== 'edit' && (phase === 0 || phase === 7) ? <p>Submit a sample message to begin.</p>
            : mode !== 'edit' && working ? <PendingTurn message={pending} rtl={sample.rtl} onDismiss={noop} />
            : <TurnView turn={turn} editing={editing} pendingEdit={working ? pending : undefined} focused={false} reviewing
                ttsReady speaking={false} rtl={sample.rtl} onBubbleTap={noop} onAskCoach={noop} onSpeak={noop} onEditUser={noop} />}
        </div>
        <div style={{ padding: 12, borderTop: '1px solid var(--line)' }}>Composer position reference · {phases[phase]}</div>
      </section>
    </div>
  </ReadingPreferencesContext>
}
createRoot(document.getElementById('root')!).render(<Fixture />)
