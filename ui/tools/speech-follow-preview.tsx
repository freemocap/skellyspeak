import { createRoot } from 'react-dom/client'
import { useEffect, useRef, useState } from 'react'
import { TargetText } from '../src/components/reading/TargetText'
import { SavedGlossText } from '../src/components/reading/SavedGlossText'
import { ReadingPreferencesContext } from '../src/components/reading/ReadingPreferences'
import { DetailDialog } from '../src/components/dialogs/DetailDialog'
import { playSpeechAudio, type PlaybackHandle } from '../src/platform/audio/speech-player'
import { readingWords } from '../src/domain/reading/word-boundaries'
import '../src/styles/index.css'

// A silent local WAV exercises the real media clock without a service request.
const bytes = new Uint8Array(44 + 16000 * 12 * 2), wav = new DataView(bytes.buffer)
for (const [offset, value] of [[0, 'RIFF'], [8, 'WAVE'], [12, 'fmt '], [36, 'data']] as const) Array.from(value).forEach((char, i) => wav.setUint8(offset + i, char.charCodeAt(0)))
wav.setUint32(4, bytes.length - 8, true); wav.setUint32(16, 16, true); wav.setUint16(20, 1, true); wav.setUint16(22, 1, true)
wav.setUint32(24, 16000, true); wav.setUint32(28, 32000, true); wav.setUint16(32, 2, true); wav.setUint16(34, 16, true); wav.setUint32(40, bytes.length - 44, true)
let binary = ''
for (const byte of bytes) binary += String.fromCharCode(byte)
const audioBase64 = btoa(binary)

function Preview() {
  const [theme, setTheme] = useState('light')
  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])
  const [text, setText] = useState('Hello again, hello world. This sentence wraps across several lines in a narrow window.')
  const [time, setTime] = useState(0), [playing, setPlaying] = useState(false), [rate, setRate] = useState(1)
  const [timed, setTimed] = useState(true), [dialog, setDialog] = useState(false), [failure, setFailure] = useState('')
  const player = useRef<PlaybackHandle | null>(null)
  useEffect(() => () => player.current?.stop(), [])
  const stop = () => { player.current?.stop(); player.current = null; setPlaying(false) }
  const play = () => {
    stop(); setFailure('')
    const parts = readingWords(text)
    const count = parts.filter(part => part.word).length
    let cursor = 0
    const starts = parts.map(part => { const start = cursor; if (part.word) cursor += 12 / count; return start })
    const alignment = timed ? { sourceText: text, original: { characters: parts.map(part => text.slice(part.start, part.end)), starts, ends: starts.map((start, i) => start + (parts[i].word ? 12 / count * 0.85 : 0)) }, normalized: null } : null
    player.current = playSpeechAudio({ audioBase64, mime: 'audio/wav', alignment }, stop, error => { setFailure(error.message); stop() }, rate, 1, { sourceText: text, onTime: setTime })
    setPlaying(true)
    void player.current.play().catch(error => { setFailure(String(error)); stop() })
  }
  const samples = <>
    <p className="msg chat-message bot"><TargetText text={text} /></p>
    <p className="msg chat-message bot"><SavedGlossText text={text} segments={readingWords(text).filter(part => part.word).map(part => ({ start: part.start, end: part.end, kind: 'gloss', gloss: 'meaning' }))} /></p>
  </>
  const controls = <div>
    <button className="btn" onClick={playing ? stop : play}>{playing ? 'Stop sample' : 'Play silent sample'}</button>
    <label>Speed <select value={rate} onChange={event => { const next = Number(event.target.value); setRate(next); player.current?.setRate(next) }}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={1.5}>1.5×</option></select></label>
    <label>Seek <input type="range" min={0} max={12} step={0.05} value={time} onChange={event => player.current?.seek(Number(event.target.value))} /></label>
    <label><input type="checkbox" checked={timed} onChange={event => { stop(); setTimed(event.target.checked) }} />Use sample timestamps</label>
    <output>{time.toFixed(2)} seconds</output>
  </div>
  return <ReadingPreferencesContext value={{ autoTranslate: true, alwaysRomanize: false, alwaysPronunciation: false }}><main style={{ maxWidth: 620, padding: 24, margin: 'auto', height: '100vh', overflow: 'auto' }}>
    <h1>Speech highlighting preview</h1><p>Silent 12-second audio tests the production player and reading components. No speech service is called. Uncheck timestamps to test estimated pacing.</p>
    <label>Theme <select value={theme} onChange={event => setTheme(event.target.value)}><option value="light">Light</option><option value="dark">Dark</option></select></label>
    <label>Source <select value={text} onChange={event => { stop(); setText(event.target.value) }}>
      {['Hello again, hello world. This sentence wraps across several lines in a narrow window.', 'مرحبا بالعالم كيف حالك اليوم', '你好世界，我们一起学习。', 'cafe\u0301 café hello hello'].map(value => <option key={value}>{value}</option>)}
    </select></label>
    {controls}{samples}
    <button className="btn" onClick={() => { stop(); setDialog(true) }}>Open dialog sample</button>
    {dialog && <DetailDialog title="Speech sample" onClose={() => { stop(); setDialog(false) }} capture="preserve">{controls}{samples}</DetailDialog>}
    {failure && <p role="alert">{failure}</p>}
  </main></ReadingPreferencesContext>
}
createRoot(document.getElementById('root')!).render(<Preview />)
