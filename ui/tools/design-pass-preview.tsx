/** Design pass proposals. Plan and findings: docs/notes/ux-design-pass/README.md.
 *
 * Review-only composition. The production stylesheet supplies tokens, fonts,
 * buttons, fields and icons; proposal layout and the PROPOSED identity colours
 * live in design-pass-preview.css. Sample content is copied from
 * content/languages/*.yaml and content/shared/conversation-topics.yaml; the
 * Practice cards are samples. Nothing here saves, signs in, records or calls AI.
 */
import { createRoot } from 'react-dom/client'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ToolbarIcon } from '../src/components/controls/ToolbarIcon'
import { PersonaAvatar } from '../src/components/media/PersonaAvatar'
import { LiveRecording } from '../src/components/media/LiveRecording'
import { useAppearance } from '../src/platform/appearance/useAppearance'
import { DEFAULT_APPEARANCE } from '../src/generated/contracts'
import type { AudioInspection, InspectionSpectrogram, ListeningTake } from '../src/generated/contracts'
import type { WaveSource } from '../src/domain/audio/waveform'
import { createSpectrumFeed } from '../src/domain/audio/spectrum-feed'
import { PREVIEW_SETTINGS } from './preview-settings'
import fixture from './spectrogram-fixture.json'
import '../src/styles/index.css'
import './design-pass-preview.css'

/** Three layout widths: Full (860px and up), Compact (400 to 859px), Narrow (under 400px). */
type Tier = 'full' | 'compact' | 'narrow'
/** The width each tier's artboard renders at: a laptop window, a large phone, a standard phone. */
const TIER_WIDTH: Record<Tier, number> = { full: 1120, compact: 430, narrow: 375 }
type Palette = 'cool' | 'warm'
type Mode = 'chat' | 'drill'

interface Language {
  id: string; name: string; endonym: string; tag: string; rtl?: boolean; scale?: number
  greeting: string; varieties: string[]
}

/** Identity, greeting and varieties from content/languages/*.yaml. */
const LANGUAGES: Language[] = [
  { id: 'arabic', name: 'Arabic', endonym: 'العربية', tag: 'ar', rtl: true, greeting: 'مَرْحَبًا', varieties: ['Levantine', 'Modern Standard'] },
  { id: 'english', name: 'English', endonym: 'English', tag: 'en', greeting: 'hello', varieties: ['United States', 'United Kingdom'] },
  { id: 'french', name: 'French', endonym: 'Français', tag: 'fr', greeting: 'bonjour', varieties: ['France', 'Canada'] },
  { id: 'german', name: 'German', endonym: 'Deutsch', tag: 'de', greeting: 'hallo', varieties: ['Germany'] },
  { id: 'hindi', name: 'Hindi', endonym: 'हिन्दी', tag: 'hi', greeting: 'नमस्ते', varieties: ['India'] },
  { id: 'indonesian', name: 'Indonesian', endonym: 'Bahasa Indonesia', tag: 'id', greeting: 'Halo', varieties: ['Indonesia'] },
  { id: 'irish', name: 'Irish', endonym: 'Gaeilge', tag: 'ga', greeting: 'dia duit', varieties: ['Ireland'] },
  { id: 'italian', name: 'Italian', endonym: 'Italiano', tag: 'it', greeting: 'ciao', varieties: ['Italy'] },
  { id: 'japanese', name: 'Japanese', endonym: '日本語', tag: 'ja', greeting: 'こんにちは', varieties: ['Japan'] },
  { id: 'korean', name: 'Korean', endonym: '한국어', tag: 'ko', greeting: '안녕하세요', varieties: ['South Korea'] },
  { id: 'malayalam', name: 'Malayalam', endonym: 'മലയാളം', tag: 'ml', greeting: 'നമസ്കാരം', varieties: ['Kerala'] },
  { id: 'mandarin', name: 'Mandarin', endonym: '中文（简体）', tag: 'zh', scale: 1.3, greeting: '你好', varieties: ['Mainland China'] },
  { id: 'portuguese', name: 'Portuguese', endonym: 'Português', tag: 'pt', greeting: 'olá', varieties: ['Brazil'] },
  { id: 'russian', name: 'Russian', endonym: 'Русский', tag: 'ru', greeting: 'Здравствуйте', varieties: ['Russia'] },
  { id: 'spanish', name: 'Spanish', endonym: 'Español', tag: 'es', greeting: 'hola', varieties: ['Spain', 'Mexico'] },
  { id: 'turkish', name: 'Turkish', endonym: 'Türkçe', tag: 'tr', greeting: 'Merhaba', varieties: ['Türkiye'] },
  { id: 'ukrainian', name: 'Ukrainian', endonym: 'Українська', tag: 'uk', greeting: 'Добрий день', varieties: ['Ukraine'] },
  { id: 'vietnamese', name: 'Vietnamese', endonym: 'Tiếng Việt', tag: 'vi', greeting: 'Xin chào', varieties: ['Vietnam'] },
]

/** Spanish labels from content/shared/conversation-topics.yaml. The start screen
 * shows up to three native starter topics. */
const TOPICS = [
  { id: 'food', target: 'Comida y bebida', translation: 'Food and drink' },
  { id: 'weekend', target: 'Planes de fin de semana', translation: 'Weekend plans' },
  { id: 'music', target: 'Música', translation: 'Music' },
]

/** Spanish default partner, content/languages/spanish.yaml. */
const PARTNER = { name: 'Lucía', symbol: '🌿', occupation: 'Veterinary nurse', location: 'Valencia, Spain' }

/** Sample Practice cards; the third is Lucía's authored opinion. */
const PHRASES = [
  { text: 'Me encanta nadar en el mar antes de trabajar.', translation: 'I love swimming in the sea before work.', takes: [54, 71, 86] },
  { text: '¿Qué te apetece tomar?', translation: 'What do you feel like having?', takes: [62] },
  { text: 'La playa es mejor en invierno.', translation: 'The beach is better in winter.', takes: [] },
]

/** Sample transcripts the chat draft receives, in order. */
const TRANSCRIPTS = ['Me gusta mucho el flamenco.', 'Y también la música indie.', '¿Y a ti qué te gusta?']

/** A synthetic microphone: the two fixture recordings as utterances with pauses
 * between them. The real LiveRecording and its waveform and spectrogram draw it;
 * only the audio is invented. */
const [REFERENCE, SPOKEN] = fixture as unknown as AudioInspection[]
const PAUSE_SECONDS = 0.8
const LEAD_IN_SECONDS = 0.6
const { STREAM, UTTERANCES } = (() => {
  const base = REFERENCE.spectrogram
  const silence = Array.from({ length: base.bins[0].length }, () => base.dbMin)
  const frames: number[] = [], bins: (number | null)[][] = [], utterances: { start: number; end: number }[] = []
  let time = 0
  const pause = (seconds: number) => {
    for (let elapsed = 0; elapsed < seconds; elapsed += base.frameSeconds) { frames.push(time); bins.push(silence); time += base.frameSeconds }
  }
  pause(LEAD_IN_SECONDS)
  for (let index = 0; index < 18; index++) {
    const clip = (index % 2 ? SPOKEN : REFERENCE).spectrogram
    const start = time
    clip.frameStartSeconds.forEach((offset, frame) => { frames.push(start + offset); bins.push(clip.bins[frame]) })
    time = start + clip.frameStartSeconds[clip.frameStartSeconds.length - 1] + clip.frameSeconds
    utterances.push({ start, end: time })
    pause(PAUSE_SECONDS)
  }
  return { STREAM: { ...base, frameStartSeconds: frames, bins } as InspectionSpectrogram, UTTERANCES: utterances }
})()
const STREAM_END = STREAM.frameStartSeconds[STREAM.frameStartSeconds.length - 1]
const speaking = (seconds: number) => UTTERANCES.some(item => seconds >= item.start && seconds < item.end)

/** Samples for the waveform, shaped by the same utterance timeline. */
function syntheticMicrophone(clock: () => number): WaveSource {
  const rate = 750
  let delivered = 0
  return {
    samplesPerSecond: rate,
    read: () => {
      const due = Math.floor(clock() * rate) - delivered
      if (due <= 0) return []
      return Array.from({ length: Math.min(due, rate) }, () => {
        const index = delivered++
        const seconds = index / rate
        const envelope = speaking(seconds) ? 0.25 + 0.55 * Math.sin(seconds * 11) ** 2 : 0.01
        return envelope * Math.sin(index * 0.9)
      })
    },
  }
}

/** A recording clock that runs while `active`, in seconds, updated a few times a second. */
function useRecordingClock(active: boolean) {
  const [seconds, setSeconds] = useState(0)
  const started = useRef(0)
  const current = useRef(0)
  // Stable, so a waveform source built on it survives re-renders.
  const read = useRef(() => current.current).current
  useEffect(() => {
    if (!active) return
    started.current = performance.now()
    current.current = 0
    setSeconds(0)
    const timer = setInterval(() => {
      current.current = Math.min(STREAM_END, (performance.now() - started.current) / 1000)
      setSeconds(current.current)
    }, 120)
    return () => clearInterval(timer)
  }, [active])
  return { seconds, read }
}

const DIFFICULTIES = ['Absolute zero', 'Beginner', 'Intermediate', 'Advanced', 'Fluent']
const TIME_FRAMES = ['Any time', 'Past events', 'Future plans']

/** PROPOSED identity roles; swatch values live in design-pass-preview.css. */
const ROLES = [
  { id: 'you', name: 'You', means: 'Your messages, your choices, and every control you press.', where: 'Your bubbles · selected cards · buttons · focus ring' },
  { id: 'partner', name: 'Partner · Chat', means: 'Your partner, what they say, and the Chat tab.', where: 'Partner card · Chat tab and surface edge' },
  { id: 'coach', name: 'Coach', means: 'Help with your messages and with replying.', where: 'Coach pane · feedback marks · reply help' },
  { id: 'drill', name: 'Practice', means: 'The Practice tab and its cards.', where: 'Practice tab and surface edge · card list' },
  { id: 'progress', name: 'Progress', means: 'XP, skills and rewards.', where: 'XP counter · reward cards · Progress' },
  { id: 'live', name: 'Live microphone', means: 'The microphone is on and recording.', where: 'Microphone pad · stream outline · recording chip' },
]

function Preview() {
  const [dark, setDark] = useState(false)
  const [tier, setTier] = useState<Tier>('full')
  const [palette, setPalette] = useState<Palette>('cool')
  useAppearance({ ...PREVIEW_SETTINGS, theme: dark ? 'dark' : 'light', appearance: { ...DEFAULT_APPEARANCE, palette } })
  const width = TIER_WIDTH[tier]
  return <main className="dp">
    <header className="dp-top">
      <div>
        <p className="dp-kicker">Design pass · proposals · sample content, no saving, sign-in, recording or AI</p>
        <h1>Three widths, first run, voice input, and the Chat and Practice tabs</h1>
        <p>Tokens, type, buttons, fields and icons are production. The arrangement and the identity colours are proposals. Numbered notes map to <code>docs/notes/ux-design-pass/</code>. Full renders at {TIER_WIDTH.full}px and shrinks to fit a narrow window.</p>
      </div>
      <div className="dp-controls" role="group" aria-label="Review controls">
        <Segmented label="Width" value={tier} onChange={setTier} options={[['full', `Full · ${TIER_WIDTH.full}`], ['compact', `Compact · ${TIER_WIDTH.compact}`], ['narrow', `Narrow · ${TIER_WIDTH.narrow}`]]} />
        <Segmented label="Palette" value={palette} onChange={setPalette} options={[['cool', 'Cool (default)'], ['warm', 'Warm']]} />
        <button type="button" className="btn" aria-pressed={dark} onClick={() => setDark(value => !value)}>
          <ToolbarIcon name={dark ? 'sun' : 'moon'} />{dark ? 'Light' : 'Dark'}
        </button>
      </div>
    </header>

    <nav className="dp-stages" aria-label="Sections">
      <a className="dp-stage" href="#dp-colour">Colour and depth</a>
      <a className="dp-stage" href="#dp-tiers">Three widths</a>
      <a className="dp-stage" href="#dp-1a">1a Language</a>
      <a className="dp-stage" href="#dp-1b">1b Sign in</a>
      <a className="dp-stage" href="#dp-1c">1c First conversation</a>
      <a className="dp-stage" href="#dp-va">Va Voice input: Chat</a>
      <a className="dp-stage" href="#dp-vb">Vb Voice input: Practice</a>
    </nav>

    <Section id="colour" index="A" title="Colour and depth"
      notes={[
        ['One meaning per colour', 'Six identity colours: you (blue), partner and Chat (apricot), coach (sage), Practice (violet), progress (gold) and the live microphone (red). Each one always means the same thing.'],
        ['Blue stays the only action colour', 'Identity colours mark places and voices. They never fill a button, so “what can I press” stays one colour.'],
        ['Pale for areas, strong for marks', 'Large surfaces get pale tints; saturated colour only on small marks: tab edges, dots, rings. The screen stays calm.'],
        ['Depth says what a surface is for', 'Raised is where you work. Recessed is what you pick from or refer to. Floating needs an answer now.'],
        ['Existing meanings stay', 'Status colours keep their meaning and always come with a word or icon. Skill-domain colours stay inside progress data.'],
      ]}>
      <ColourLegend />
    </Section>

    <Section id="tiers" index="W" title="Three widths" note="Use the Width control above" width={width}
      notes={[
        ['Full (860px and up)', 'Monitors and laptops. Chat and Practice are tabs at the top. Side panels are open: the coach on the right in Chat, the cards on the left in Practice. Each folds to its edge tab.'],
        ['Compact (400 to 859px)', 'Large phones, tablets and narrow windows. Tabs move to the bottom. Side panels are coloured edge tabs that slide a panel over the surface.'],
        ['Narrow (under 400px)', 'Standard phones. Tabs at the bottom. The coach is a button in the chat header and the cards a chip in Practice; each opens a sheet from the bottom.'],
        ['Width, not device', 'The tier follows the space the app has, so a desktop window dragged narrow behaves like a phone. The app has one breakpoint today (860px); this adds one at 400px.'],
        ['Same controls in every tier', 'The voice panel, toggle, arrow and words are identical; only the side panels change how they open.'],
      ]}>
      <Workspace tier={tier} initial="chat" chatStage="conversation" />
    </Section>

    <Section id="1a" index="1a" title="Choose a language" current="/tools/onboarding-live-preview.html" width={width}
      notes={[
        ['Nothing important scrolls away', 'The title stays at the top, the language list scrolls in its own recessed well, and the action bar stays at the bottom. Continue is always on screen and never moves.'],
        ['One row, always', 'The bar has four fixed slots: the language, its variety, the explanation language and Continue. A language with one variety shows its name instead of a menu, so the row never changes shape.'],
        ['One tap chooses', 'Cards are single choice. Other languages are added later from Browse languages.'],
        ['Named once', 'Own name, a greeting, and the name in your language only when it differs.'],
        ['One orienting line', 'Setup screens keep their single line of explanation; working surfaces carry none.'],
      ]}>
      <LanguageScreen />
    </Section>

    <Section id="1b" index="1b" title="Sign in" current="/tools/onboarding-live-preview.html" width={width}
      notes={[
        ['One primary action', 'Sign in with Google. The route tabs and the “SkellySpeak account” row are settings layout, not first-run layout.'],
        ['Details one click away', 'Your own server and the cost and free-software notes are collapsed, with the existing copy.'],
        ['Next step is obvious', 'After sign-in the screen confirms the account and Continue becomes the next action. Try it.'],
        ['Same access system', 'Routes, credentials, validation and errors stay in SettingsAccess; only the arrangement changes.'],
      ]}>
      <SignInScreen />
    </Section>

    <Section id="1c" index="1c" title="Start the first conversation" current="/tools/conversation-preview.html" width={width}
      currentNote="Press “Opening / conversation” in the fixture bar to see the current start screen."
      notes={[
        ['Who, what, options, start', 'One reading order, top to bottom, with one primary action at the end.'],
        ['Topics select, they do not start', 'Today every topic and “Practice selection” button starts an AI request on click. Here they are choices; the chosen topic applies to whichever way you start.'],
        ['Two starts', 'The card starts Lucía. Below, the empty stream points at the microphone.'],
        ['The coach at each width', 'Open beside the conversation at Full, with only its Ask box until there is coaching; an edge tab at Compact; a header button at Narrow.'],
        ['Partner facts in your language', 'Occupation and city appear in the explanation language, whatever language is being practised.'],
      ]}>
      <Workspace tier={tier} initial="chat" />
    </Section>

    <Section id="va" index="Va" title="Voice input in Chat" note="One panel for Chat and Practice" current="/tools/conversation-preview.html" width={width}
      notes={[
        ['The same panel as Practice', 'Same microphone pad, stream, prompt, chip, toggle, settings and colours. Chat only adds Type, Auto-send, and a draft with its own Send.'],
        ['A microphone, not a word', 'The pad is only ever the microphone: a calm blue when ready, red with a red outline and glow while recording. Press it again to stop; in Hold, let go.'],
        ['One arrow, one sentence', '“Press the microphone to start” in the middle of one arrow across the whole stream, in every mode and on both surfaces.'],
        ['The draft sends itself', 'The transcript lands in the stream area as editable text with Send and Discard beside it. Auto-send skips the draft.'],
        ['Auto is coming', 'Auto stays in the toggle so the controls match Practice. In Chat it shows a small “Coming soon” tag until the native work (A9) lands.'],
      ]}>
      <Workspace tier={tier} initial="chat" chatStage="conversation" />
    </Section>

    <Section id="vb" index="Vb" title="Voice input in Practice" note="Same panel, attempts instead of a draft" current="/tools/drill-live-preview.html" width={width}
      notes={[
        ['Cards at each width', 'Open on the left at Full; an edge tab with a violet stripe at Compact; a chip that opens a sheet at Narrow. Each folds away the same way the coach does.'],
        ['Identical recorder', 'The same component as Chat: same size, pad, arrow, words, toggle and settings. Practice has no draft, Type or Auto-send.'],
        ['Attempts in the stream', 'In Auto each pause cuts an attempt, marked in the stream; the attempt list appears once there is one. The chip shows only the time, as in Chat.'],
        ['Auto keeps its controls', 'The level meter and its threshold show in Auto. Detect attempts is today’s “Auto detect takes”: turned off, the stream keeps running and no attempts are made.'],
        ['Words', 'Practice (the tab), card (what you practise), reference (the voice you copy), attempt (each recording of you), match (the score).'],
        ['Not shown, and kept', 'The reference and attempt comparison, spectrograms, word alignment, attempt report and history, Previous / Next / Random, analysis and storage stay as they are. This page shows only what changes around them.'],
      ]}>
      <Workspace tier={tier} initial="drill" />
    </Section>
  </main>
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (value: T) => void }) {
  return <div className="dp-segmented" role="group" aria-label={label}>
    {options.map(([id, text]) => <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)}>{text}</button>)}
  </div>
}

function Section({ id, index, title, note, current, currentNote, notes, width, children }: {
  id: string; index: string; title: string; note?: string; current?: string; currentNote?: string; notes: [string, string][]
  /** A true pixel width for the artboard; it is scaled down, never up, to fit. */
  width?: number
  children: ReactNode
}) {
  return <section className="dp-section" id={`dp-${id}`} aria-labelledby={`dp-${id}-title`}>
    <div className="dp-section-head">
      <h2 id={`dp-${id}-title`}><span className="dp-index">{index}</span>{title}</h2>
      {note && <span className="dp-current-note">{note}</span>}
      {current && <a className="dp-current" href={current} target="_blank" rel="noreferrer">Open current <ToolbarIcon name="popout" size={14} /></a>}
      {currentNote && <span className="dp-current-note">{currentNote}</span>}
    </div>
    <div className="dp-row">
      <Artboard width={width}>{children}</Artboard>
      <ol className="dp-notes">{notes.map(([head, body]) => <li key={head}><strong>{head}</strong><span>{body}</span></li>)}</ol>
    </div>
  </section>
}

/** An artboard at a true width, scaled down with a transform so container
 * queries inside it still see that width. */
function Artboard({ width, children }: { width?: number; children: ReactNode }) {
  const holder = useRef<HTMLDivElement>(null)
  const board = useRef<HTMLElement>(null)
  const [fit, setFit] = useState({ scale: 1, height: 0 })
  useLayoutEffect(() => {
    if (!width) return
    const measure = () => {
      const available = holder.current?.clientWidth ?? width
      const scale = Math.min(1, available / width)
      setFit({ scale, height: (board.current?.offsetHeight ?? 0) * scale })
    }
    const observer = new ResizeObserver(measure)
    if (holder.current) observer.observe(holder.current)
    if (board.current) observer.observe(board.current)
    measure()
    return () => observer.disconnect()
  }, [width])
  if (!width) return <figure className="dp-artboard">{children}</figure>
  return <div ref={holder} className="dp-artboard-holder" style={{ height: fit.height || undefined }}>
    <figure ref={board} className="dp-artboard" style={{ width, transform: fit.scale < 1 ? `scale(${fit.scale})` : undefined }}>{children}</figure>
    {fit.scale < 1 && <span className="dp-scale-note">{Math.round(fit.scale * 100)}%</span>}
  </div>
}

function ColourLegend() {
  return <div className="dp-legend">
    <div className="dp-roles">
      {ROLES.map(role => <div key={role.id} className="dp-role" data-role={role.id}>
        <span className="dp-role-head"><span className="dp-role-mark" aria-hidden="true" />{role.name}</span>
        <p>{role.means}</p>
        <small>{role.where}</small>
      </div>)}
    </div>
    <div className="dp-legend-row">
      <span className="dp-legend-label">Status, unchanged</span>
      <span className="dp-status" data-status="success"><ToolbarIcon name="check" size={14} />Saved</span>
      <span className="dp-status" data-status="warning">Paused: usage limit</span>
      <span className="dp-status" data-status="danger">Reply failed</span>
    </div>
    <div className="dp-depths">
      <div className="dp-depth" data-depth="ground"><strong>Ground</strong><span>Behind everything</span></div>
      <div className="dp-depth" data-depth="raised"><strong>Raised</strong><span>Where you work: the conversation, the Practice stage</span></div>
      <div className="dp-depth" data-depth="recessed"><strong>Recessed</strong><span>What you pick from or refer to: lists, the coach</span></div>
      <div className="dp-depth" data-depth="floating"><strong>Floating</strong><span>What needs an answer now: dialogs, the Continue bar</span></div>
    </div>
  </div>
}

function OnboardingHead({ step }: { step: 1 | 2 }) {
  return <header className="dp-head">
    <p className="dp-wordmark"><img src="/skellyspeak-logo.png" alt="" width="28" height="28" />SkellySpeak</p>
    <div className="dp-head-end">
      <span className="onboarding-rail" aria-label={`Setup ${step} of 2`}>
        <span className="onboarding-rail-step" data-state={step > 1 ? 'done' : 'current'} />
        <span className="onboarding-rail-step" data-state={step > 1 ? 'current' : 'todo'} />
      </span>
      <label className="dp-app-language"><ToolbarIcon name="globe" size={15} /><span className="dp-visually-hidden">App language</span>
        <select defaultValue="english"><option value="english">English</option><option value="spanish">Español</option><option value="french">Français</option><option value="german">Deutsch</option></select>
      </label>
    </div>
  </header>
}

const EXPLANATION_LANGUAGES = ['English', 'Español', 'Français', 'Deutsch', 'Português', 'العربية', '中文（简体）']

function LanguageScreen() {
  const [chosen, setChosen] = useState<string | null>(null)
  const [varieties, setVarieties] = useState<Record<string, string>>({})
  const selected = LANGUAGES.find(language => language.id === chosen)
  const variety = selected ? varieties[selected.id] ?? selected.varieties[0] : null
  return <div className="dp-onboarding dp-frame">
    <section className="dp-sheet dp-sheet-frame">
      <div className="dp-frame-head">
        <OnboardingHead step={1} />
        <div className="dp-heading">
          <h1 className="dp-title">What do you want to practise?</h1>
          <p className="dp-lead">Pick one to start. You can add more languages later.</p>
        </div>
      </div>
      <div className="dp-well">
        <div className="dp-languages" role="radiogroup" aria-label="Language to practise">
          {LANGUAGES.map(language => <button key={language.id} type="button" role="radio" aria-checked={chosen === language.id}
            className="dp-language" onClick={() => setChosen(language.id)}>
            <span className="dp-endonym" lang={language.tag} dir={language.rtl ? 'rtl' : 'ltr'}
              style={{ ['--script-scale' as string]: language.scale ?? 1 }}>{language.endonym}</span>
            <span className="dp-greeting" lang={language.tag} dir={language.rtl ? 'rtl' : 'ltr'}>{language.greeting}</span>
            {language.name !== language.endonym && <span className="dp-language-name">{language.name}</span>}
            {chosen === language.id && <span className="dp-language-check" aria-hidden="true"><ToolbarIcon name="check" size={14} /></span>}
          </button>)}
        </div>
      </div>
      {/* Four fixed slots, one row at every width: nothing appears or disappears. */}
      <footer className="dp-action-bar" data-ready={selected ? 'true' : 'false'}>
        <div className="dp-bar-choice">
          <span className="dp-bar-label">Language</span>
          {selected
            ? <span className="dp-bar-value"><span className="dp-choice-greeting" lang={selected.tag} dir={selected.rtl ? 'rtl' : 'ltr'}>{selected.greeting}</span><strong>{selected.name}</strong></span>
            : <span className="dp-bar-value dp-muted">Choose above</span>}
        </div>
        <label className="dp-bar-field">
          <span className="dp-bar-label">Variety</span>
          {selected && selected.varieties.length > 1
            ? <select value={variety ?? ''} onChange={event => setVarieties(current => ({ ...current, [selected.id]: event.target.value }))}>
              {selected.varieties.map(item => <option key={item}>{item}</option>)}
            </select>
            : <span className="dp-bar-static">{variety ?? '—'}</span>}
        </label>
        <label className="dp-bar-field">
          <span className="dp-bar-label">Explain in</span>
          <select defaultValue="English">{EXPLANATION_LANGUAGES.map(name => <option key={name}>{name}</option>)}</select>
        </label>
        <button type="button" className="btn primary dp-continue" disabled={!selected}>Continue</button>
      </footer>
    </section>
  </div>
}

function SignInScreen() {
  const [signedIn, setSignedIn] = useState(false)
  return <div className="dp-onboarding">
    <section className="dp-sheet dp-sheet-narrow">
      <OnboardingHead step={2} />
      <div className="dp-heading">
        <button type="button" className="dp-back" onClick={() => setSignedIn(false)}><ToolbarIcon name="chevron" size={14} />Languages</button>
        <h1 className="dp-title">Sign in</h1>
        <p className="dp-lead">Conversations, feedback and speech use AI models on the SkellySpeak server. Signing in with Google includes a free daily allowance.</p>
      </div>
      {signedIn
        ? <p className="dp-signed-in" role="status"><span className="dp-signed-in-mark" aria-hidden="true"><ToolbarIcon name="check" size={14} /></span>
          <span>Signed in as <strong>learner@example.com</strong></span>
          <button type="button" className="dp-link" onClick={() => setSignedIn(false)}>Use another account</button></p>
        : <button type="button" className="btn primary dp-hero-action" onClick={() => setSignedIn(true)}>Sign in with Google</button>}
      <div className="dp-disclosures">
        <details className="dp-disclosure">
          <summary>Use your own server</summary>
          <div className="form-row"><label htmlFor="dp-server">Server address</label><input id="dp-server" placeholder="https://your-server.example/v1" /></div>
          <div className="form-row check-row"><label className="check-label"><input type="checkbox" />Use server session token</label></div>
          <button type="button" className="btn">Check connection</button>
        </details>
        <details className="dp-disclosure">
          <summary>Costs and free software</summary>
          <p className="field-note">Each AI request costs money; the server charges for use beyond the free daily allowance.</p>
          <p className="field-note">Payments pay for the server and fund development and the FreeMoCap Foundation.</p>
          <p className="field-note">SkellySpeak is <span className="md-term">free software</span>: you can use, study, change and share it, and run your own server.</p>
        </details>
      </div>
      <footer className="dp-sheet-actions">
        <button type="button" className="btn">Set up later</button>
        <button type="button" className="btn primary" disabled={!signedIn}>Continue</button>
      </footer>
    </section>
  </div>
}

/** The proposed shell at one of three widths: the global bar, the active mode's
 * surface, and its side panel (open, an edge drawer, or a bottom sheet). */
function Workspace({ tier, initial, chatStage = 'start' }: { tier: Tier; initial: Mode; chatStage?: 'start' | 'conversation' }) {
  const [mode, setMode] = useState<Mode>(initial)
  const full = tier === 'full'
  // Side panels start open where there is room, and folded where there is not.
  const [coachOpen, setCoachOpen] = useState(full)
  const [cardsOpen, setCardsOpen] = useState(full)
  useEffect(() => { setCoachOpen(full); setCardsOpen(full) }, [full])
  return <div className="dp-app" data-mode={mode} data-tier={tier}>
    <div className="dp-shellbar">
      <span className="dp-topbar-brand"><img src="/skellyspeak-logo.png" alt="" width="24" height="24" /><span className="dp-brand-name">SkellySpeak</span></span>
      <span className="dp-topbar-language">Español<ToolbarIcon name="chevron" size={14} /></span>
      <span className="dp-spacer" />
      {full && <ModeTabs mode={mode} onMode={setMode} />}
      <span className="dp-spacer" />
      <span className="dp-xp"><ToolbarIcon name="star" size={15} />{mode === 'chat' ? 0 : 124}<span className="dp-xp-unit">XP</span></span>
      <span className="dp-ai" title="AI connected"><span className="dp-dot" />AI</span>
      <span className="dp-bar-icon dp-bar-settings" aria-label="Settings"><ToolbarIcon name="cog" /></span>
      <span className="dp-bar-icon" aria-label="More"><ToolbarIcon name="more" /></span>
    </div>
    <div className="dp-workspace">
      {mode === 'chat'
        ? <ChatSurface tier={tier} stage={chatStage} coachOpen={coachOpen} onCoach={setCoachOpen} />
        : <DrillSurface tier={tier} open={cardsOpen} onOpen={setCardsOpen} />}
    </div>
    {!full && <nav className="dp-modebar" role="tablist" aria-label="Practice">
      {(['chat', 'drill'] as const).map(item => <button key={item} type="button" role="tab" data-mode={item} aria-selected={mode === item} onClick={() => setMode(item)}>
        <ToolbarIcon name={item === 'chat' ? 'chat' : 'cards'} size={20} />{item === 'chat' ? 'Chat' : 'Practice'}</button>)}
    </nav>}
  </div>
}

function ModeTabs({ mode, onMode }: { mode: Mode; onMode: (mode: Mode) => void }) {
  return <div className="dp-tabs" role="tablist" aria-label="Practice">
    {(['chat', 'drill'] as const).map(item => <button key={item} type="button" role="tab" className="dp-tab" data-mode={item}
      aria-selected={mode === item} onClick={() => onMode(item)}>
      <ToolbarIcon name={item === 'chat' ? 'chat' : 'cards'} size={18} />{item === 'chat' ? 'Chat' : 'Practice'}</button>)}
  </div>
}

/** How a side panel shows at a width: beside the surface, over it from its
 * edge, or as a sheet from the bottom. */
const PANEL_VARIANT: Record<Tier, 'panel' | 'drawer' | 'sheet'> = { full: 'panel', compact: 'drawer', narrow: 'sheet' }

function ChatSurface({ tier, stage, coachOpen, onCoach }: { tier: Tier; stage: 'start' | 'conversation'; coachOpen: boolean; onCoach: (open: boolean) => void }) {
  const [sent, setSent] = useState<string[]>([])
  const send = useCallbackStable((text: string) => setSent(current => [...current, text]))
  const starting = stage === 'start' && sent.length === 0
  const variant = PANEL_VARIANT[tier]
  const edge = tier !== 'narrow' && !coachOpen
  return <div className="dp-chat-area" data-coach={coachOpen && variant === 'panel' ? 'open' : 'closed'}>
    <section className="dp-chat" aria-label="Conversation">
      <ChatHeader tier={tier} onCoach={() => onCoach(true)} />
      <div className="dp-stream">
        {starting ? <StartCard /> : <div className="dp-thread">
          {stage === 'conversation' && <div className="dp-bubble" data-voice="partner">
            <p lang="es">Hola, soy Lucía. ¿Qué música te gusta?</p>
            <small>Hello, I’m Lucía. What music do you like?</small>
          </div>}
          {sent.map((text, index) => <div key={index} className="dp-bubble" data-voice="you"><p lang="es">{text}</p></div>)}
        </div>}
      </div>
      <VoicePanel context="chat" narrow={tier === 'narrow'}
        transcripts={stage === 'start' ? ['Hola, ¿qué tal?', ...TRANSCRIPTS] : TRANSCRIPTS} onSend={send} />
    </section>
    {edge && <button type="button" className="dp-edge" data-role="coach" aria-expanded={false} aria-label="Open coach" onClick={() => onCoach(true)}>
      <ToolbarIcon name="idea" size={16} /><span>Coach</span></button>}
    {coachOpen && <SidePanel role="coach" variant={variant} title="Coach" icon="idea" onClose={() => onCoach(false)}>
      <div className="dp-coach-body">
        {!starting && <button type="button" className="dp-coach-help"><ToolbarIcon name="idea" size={15} />Help with this reply</button>}
      </div>
      <form className="dp-coach-ask" onSubmit={event => event.preventDefault()}>
        <textarea rows={1} aria-label="Ask the coach" placeholder="Ask the coach…" />
        <button type="submit" className="dp-voice-send" aria-label="Send to the coach">↑</button>
      </form>
    </SidePanel>}
  </div>
}

/** One side panel for the coach and the cards, in each width's variant. */
function SidePanel({ role, variant, title, icon, onClose, children }: {
  role: 'coach' | 'drill'; variant: 'panel' | 'drawer' | 'sheet'; title: string; icon: 'idea' | 'cards'; onClose: () => void; children: ReactNode
}) {
  return <>
    {variant !== 'panel' && <div className="dp-scrim" aria-hidden="true" onClick={onClose} />}
    <aside className="dp-side" data-role={role} data-variant={variant} aria-label={title}>
      <header className="dp-side-head">
        <h3><ToolbarIcon name={icon} size={16} />{title}</h3>
        <button type="button" className="dp-side-close" data-side={role === 'coach' ? 'end' : 'start'} aria-label={`Fold ${title.toLowerCase()} away`} onClick={onClose}>
          <ToolbarIcon name={variant === 'sheet' ? 'close' : 'chevron'} size={16} /></button>
      </header>
      {children}
    </aside>
  </>
}

function ChatHeader({ tier, onCoach }: { tier: Tier; onCoach: () => void }) {
  return <header className="dp-chat-head">
    {tier === 'full'
      ? <button type="button" className="dp-text-button">Conversations</button>
      : <button type="button" className="dp-icon-button" aria-label="Conversations"><ToolbarIcon name="menu" /></button>}
    <button type="button" className="dp-partner-toggle"><PersonaAvatar symbol={PARTNER.symbol} /><strong>{PARTNER.name}</strong><ToolbarIcon name="chevron" size={14} /></button>
    <span className="dp-spacer" />
    {tier === 'narrow' && <button type="button" className="dp-coach-button" onClick={onCoach}><ToolbarIcon name="idea" size={15} />Coach</button>}
    <button type="button" className="dp-icon-button" aria-label="Conversation settings"><ToolbarIcon name="settings" /></button>
    {tier !== 'narrow' && <button type="button" className="dp-icon-button" aria-label="New conversation"><ToolbarIcon name="plus" /></button>}
  </header>
}

function StartCard() {
  const [topic, setTopic] = useState<string>('partner')
  const [difficulty, setDifficulty] = useState('Beginner')
  const [time, setTime] = useState('Any time')
  const [starting, setStarting] = useState(false)
  const summary = [difficulty, time].join(' · ')
  return <div className="dp-start">
    <div className="dp-partner">
      <PersonaAvatar symbol={PARTNER.symbol} />
      <div className="dp-partner-text">
        <h3>{PARTNER.name}</h3>
        <p>{PARTNER.occupation} · {PARTNER.location}</p>
      </div>
      <div className="dp-partner-links">
        <button type="button" className="dp-link">About {PARTNER.name}</button>
        <button type="button" className="dp-link">Change partner</button>
      </div>
    </div>

    <fieldset className="dp-fieldset">
      <legend>Topic</legend>
      <div className="dp-chips" role="radiogroup" aria-label="Topic">
        <button type="button" role="radio" aria-checked={topic === 'partner'} className="dp-chip" onClick={() => setTopic('partner')}>
          <span className="dp-chip-label">{PARTNER.name} chooses</span></button>
        {TOPICS.map(item => <button key={item.id} type="button" role="radio" aria-checked={topic === item.id} className="dp-chip" onClick={() => setTopic(item.id)}>
          <span className="dp-chip-target" lang="es">{item.target}</span><span className="dp-chip-translation">{item.translation}</span></button>)}
        <button type="button" role="radio" aria-checked={topic === 'own'} className="dp-chip" onClick={() => setTopic('own')}>
          <span className="dp-chip-label"><ToolbarIcon name="plus" size={14} />Your own topic</span></button>
      </div>
    </fieldset>

    <details className="dp-options">
      <summary><span>Options</span><span className="dp-options-summary">{summary}</span><ToolbarIcon name="chevron" size={14} /></summary>
      <div className="dp-options-body">
        <OptionRow label="Difficulty" values={DIFFICULTIES} value={difficulty} onChange={setDifficulty} />
        <OptionRow label="Time frame" values={TIME_FRAMES} value={time} onChange={setTime} />
        <button type="button" className="dp-link dp-prompt-link">Prompt details…</button>
      </div>
    </details>

    <div className="dp-start-actions">
      <button type="button" className="btn primary" disabled={starting} onClick={() => { setStarting(true); setTimeout(() => setStarting(false), 1600) }}>
        <ToolbarIcon name="chat" />{starting ? 'Starting…' : `${PARTNER.name} starts`}</button>
    </div>
  </div>
}

/** The tab, colour, depth, card panel and the shared voice panel; Stage 3
 * designs the rest of Practice. */
function DrillSurface({ tier, open, onOpen }: { tier: Tier; open: boolean; onOpen: (open: boolean) => void }) {
  const [index, setIndex] = useState(0)
  const [extra, setExtra] = useState<number[][]>(PHRASES.map(() => []))
  const phrase = PHRASES[index]
  const takes = [...phrase.takes, ...extra[index]]
  const variant = PANEL_VARIANT[tier]
  const addTake = useCallbackStable(() => setExtra(current => current.map((list, position) => position === index
    ? [...list, TAKE_SCORES[(list.length + position) % TAKE_SCORES.length]] : list)))
  return <div className="dp-drill" data-phrases={open && variant === 'panel' ? 'open' : 'closed'}>
    {open && <SidePanel role="drill" variant={variant} title="Cards" icon="cards" onClose={() => onOpen(false)}>
      <ul className="dp-phrase-list" aria-label="Cards">
        {PHRASES.map((item, position) => {
          const all = [...item.takes, ...extra[position]]
          return <li key={item.text}><button type="button" aria-current={position === index} onClick={() => { setIndex(position); if (variant !== 'panel') onOpen(false) }}>
            <span lang="es">{item.text}</span><small>{all.length ? `${all.length} ${all.length === 1 ? 'attempt' : 'attempts'} · best ${Math.max(...all)}% match` : 'No attempts'}</small></button></li>
        })}
      </ul>
      <button type="button" className="btn dp-add-phrases"><ToolbarIcon name="plus" size={15} />Add cards</button>
    </SidePanel>}
    {tier !== 'narrow' && !open && <button type="button" className="dp-edge" data-role="drill" aria-expanded={false} aria-label="Open cards" onClick={() => onOpen(true)}>
      <ToolbarIcon name="cards" size={16} /><span>Cards</span><span className="dp-edge-count">{index + 1}/{PHRASES.length}</span></button>}
    <section className="dp-drill-stage" aria-label="Practice stage">
      <div className="dp-drill-top">
        {tier === 'narrow' && <button type="button" className="dp-phrase-chip" aria-expanded={open} onClick={() => onOpen(true)}>
          <ToolbarIcon name="cards" size={15} />Cards · {index + 1}/{PHRASES.length}<ToolbarIcon name="chevron" size={14} /></button>}
        <div className="dp-phrase-card">
          <p className="dp-phrase" lang="es">{phrase.text}</p>
          <p className="dp-phrase-translation">{phrase.translation}</p>
          <button type="button" className="btn dp-listen"><ToolbarIcon name="play" size={16} />Play reference</button>
        </div>
        {takes.length > 0 && <div className="dp-takes" aria-label="Your attempts">
          {[...takes].reverse().slice(0, 4).map((score, position) => <span key={`${takes.length}-${position}`} className="dp-take">
            <span className="dp-take-bar" style={{ ['--take' as string]: `${score}%` }} />Attempt {takes.length - position} · {score}% match</span>)}
        </div>}
      </div>
      <VoicePanel context="drill" narrow={tier === 'narrow'} key={index} onTake={addTake} />
    </section>
  </div>
}

/** A callback whose identity never changes but always calls the latest function. */
function useCallbackStable<A extends unknown[]>(callback: (...args: A) => void) {
  const latest = useRef(callback)
  latest.current = callback
  return useRef((...args: A) => latest.current(...args)).current
}

/** Sample match scores for takes cut in the preview. */
const TAKE_SCORES = [68, 79, 74, 88, 91, 83]

type VoiceMode = 'tap' | 'hold' | 'auto'
type VoicePhase = 'ready' | 'recording' | 'transcribing' | 'draft'
const MODE_LABELS: Record<VoiceMode, string> = { tap: 'Tap', hold: 'Hold', auto: 'Auto' }
/** The empty stream's only words, the same in every mode and on every surface. */
const VOICE_PROMPT = 'Press the microphone to start'

/** One recorder for Chat and Practice, identical on both. A microphone pad sits at
 * the "now" end of the stream with the mode toggle under it; the pad only ever
 * starts and stops the microphone and says so with colour, not words. Chat adds
 * a draft (with its own Send) where the stream was, plus Type and Auto-send.
 * Chat's Auto stays in the toggle and says "Coming soon" until it exists. */
function VoicePanel({ context, narrow, transcripts = TRANSCRIPTS, onSend, onTake }: {
  context: 'chat' | 'drill'
  narrow: boolean
  transcripts?: string[]
  onSend?: (text: string) => void
  onTake?: () => void
}) {
  const chat = context === 'chat'
  const autoAvailable = !chat
  const [mode, setMode] = useState<VoiceMode>(chat ? 'tap' : 'auto')
  const [phase, setPhase] = useState<VoicePhase>('ready')
  const [draft, setDraft] = useState('')
  const [typing, setTyping] = useState(false)
  const [autoSend, setAutoSend] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [soon, setSoon] = useState(false)
  const [session, setSession] = useState(0)
  // Practice's Auto: whether pauses cut attempts, and which utterances were cut.
  const [detect, setDetect] = useState(true)
  const [cut, setCut] = useState<number[]>([])
  const heard = useRef(0)
  const processed = useRef(0)
  const recording = phase === 'recording'
  const busy = phase === 'transcribing'
  const clock = useRecordingClock(recording)
  const source = useMemo(() => session > 0 ? syntheticMicrophone(clock.read) : null, [session, clock.read])
  const streamed = useMemo(() => session > 0 ? streamWindow(clock.seconds) : null, [session, clock.seconds])
  // The stream reads its spectrum from a feed, as in the app.
  const [feed] = useState(createSpectrumFeed)
  useEffect(() => { feed.set(streamed ? { data: streamed, endSeconds: Math.max(clock.seconds, 0.01) } : null) }, [feed, streamed, clock.seconds])
  // Utterances a pause has finished. With Detect attempts off they pass uncut.
  const finished = mode === 'auto' ? UTTERANCES.filter(item => item.end + 0.6 <= clock.seconds).length : 0
  const autoTakes: ListeningTake[] = cut.map((index, number) => ({
    recordingId: `take-${number + 1}`, number: number + 1, startSeconds: UTTERANCES[index].start, endSeconds: UTTERANCES[index].end,
    cutSeconds: UTTERANCES[index].end + 0.6, state: 'completed', failure: null,
  }))
  const nextTranscript = () => transcripts[heard.current++ % transcripts.length]
  const append = (text: string) => setDraft(current => current.trim() ? `${current.trim()} ${text}` : text)

  useEffect(() => {
    if (!recording || finished <= processed.current) return
    const fresh = Array.from({ length: finished - processed.current }, (_, n) => processed.current + n)
    processed.current = finished
    if (!detect) return
    setCut(current => [...current, ...fresh])
    for (let n = 0; n < fresh.length; n++) onTake?.()
  })
  useEffect(() => {
    if (!soon) return
    const timer = setTimeout(() => setSoon(false), 1800)
    return () => clearTimeout(timer)
  }, [soon])

  const start = () => {
    setSettingsOpen(false); processed.current = 0; setCut([])
    setSession(value => value + 1); setPhase('recording')
  }
  const finish = () => {
    if (mode === 'auto') { setPhase('ready'); return }
    if (!chat) { setPhase('ready'); onTake?.(); return }
    setPhase('transcribing')
    setTimeout(() => {
      const text = nextTranscript()
      if (autoSend) { onSend?.(text); setPhase('ready'); setSession(0) }
      else { append(text); setPhase('draft') }
    }, 1100)
  }
  const send = () => {
    const text = draft.trim()
    if (!text) return
    onSend?.(text); setDraft(''); setTyping(false); setPhase('ready'); setSession(0)
  }
  const discard = () => { setDraft(''); setTyping(false); setPhase('ready'); setSession(0) }
  const chooseMode = (option: VoiceMode) => {
    if (option === 'auto' && !autoAvailable) { setSoon(true); return }
    setMode(option); processed.current = 0; setCut([])
  }
  const textFace = chat && !recording && !busy && (typing || draft.trim().length > 0)
  const pressPad = () => { if (recording) finish(); else if (!busy) start() }
  const padEvents = mode === 'hold'
    ? { onPointerDown: () => { if (!recording && !busy) start() }, onPointerUp: () => { if (recording) finish() }, onPointerLeave: () => { if (recording) finish() } }
    : { onClick: pressPad }
  const seconds = Math.floor(clock.seconds)
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
  return <section className="dp-voice" data-context={context} data-phase={phase} aria-label="Voice input">
    <div className="dp-voice-grid">
      <div className="dp-voice-face">
        {textFace
          ? <div className="dp-voice-draft">
            <textarea className="dp-voice-text" aria-label="Message" lang="es" dir="auto" value={draft} autoFocus={typing}
              onChange={event => setDraft(event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send() } }} />
            <div className="dp-voice-draft-actions">
              <button type="button" className="dp-voice-discard" aria-label="Discard" title="Discard" disabled={!draft.trim()} onClick={discard}><ToolbarIcon name="trash" size={16} /></button>
              <button type="button" className="dp-voice-send" aria-label="Send" title="Send" disabled={!draft.trim()} onClick={send}>↑</button>
            </div>
          </div>
          : streamed
            // Time runs left to right: the newest audio is at the inline end, next to the pad.
            ? <LiveRecording time="ltr" active={recording} source={recording ? source : null} spectrum={feed} takes={autoTakes} />
            : <div className="dp-voice-prompt" aria-hidden="true"><span className="dp-voice-prompt-text">{VOICE_PROMPT}</span><ToolbarIcon name="chevron" size={18} /></div>}
        {recording && <span className="dp-voice-chip" role="status"><span className="dp-voice-dot" aria-hidden="true" />{time}</span>}
        {busy && <span className="dp-voice-overlay" role="status">Transcribing…</span>}
      </div>
      <button type="button" className="dp-voice-pad" data-live={recording} aria-pressed={recording}
        aria-label={recording ? 'Stop the microphone' : 'Start the microphone'} title={recording ? 'Stop the microphone' : VOICE_PROMPT} disabled={busy} {...padEvents}>
        <ToolbarIcon name="mic" size={narrow ? 26 : 30} />
      </button>
      <div className="dp-voice-controls">
        <button type="button" className="dp-mini dp-mini-icon" aria-label="Recording settings" title="Recording settings" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(value => !value)}><ToolbarIcon name="settings" size={15} /></button>
        {mode === 'auto' && <VoiceMeter active={recording} seconds={clock.seconds} />}
        {chat && <>
          <button type="button" className="dp-mini dp-voice-type" aria-pressed={textFace} disabled={recording || busy} onClick={() => setTyping(value => !value)}>
            <ToolbarIcon name="keyboard" size={15} /><span className="dp-mini-text">Type</span></button>
          <label className="dp-switch"><input type="checkbox" checked={autoSend} onChange={event => setAutoSend(event.target.checked)} />Auto-send</label>
        </>}
        {!chat && mode === 'auto' && <label className="dp-switch"><input type="checkbox" checked={detect} onChange={event => setDetect(event.target.checked)} />Detect attempts</label>}
      </div>
      <div className="dp-voice-modes" role="radiogroup" aria-label="Recording mode">
        {(['tap', 'hold', 'auto'] as const).map(option => {
          const later = option === 'auto' && !autoAvailable
          return <button key={option} type="button" role="radio" aria-checked={mode === option} aria-disabled={later || undefined} data-later={later || undefined}
            disabled={recording || busy} onClick={() => chooseMode(option)}>{MODE_LABELS[option]}</button>
        })}
        {soon && <span className="dp-soon" role="status">Coming soon</span>}
      </div>
    </div>
    {settingsOpen && <div className="dp-voice-settings">
      <div className="dp-option-row"><span className="dp-option-label">Microphone</span><select className="field" defaultValue="default"><option value="default">System default</option></select></div>
      {/* Today's Drill settings with their policy values; Chat's Tap and Hold have none of these. */}
      {mode === 'auto' && <>
        <OptionRow label="End an attempt after silence of" values={['0.6 s', '1 s', '1.5 s', '2 s', '2.5 s']} value="1 s" onChange={() => {}} />
        <OptionRow label="Stop listening after silence of" values={['5 s', '10 s', '15 s', '30 s', '60 s']} value="10 s" onChange={() => {}} />
      </>}
      {!chat && <OptionRow label="Ignore sounds shorter than" values={['0.16 s', '0.3 s', '0.6 s', '1 s']} value="0.3 s" onChange={() => {}} />}
    </div>}
  </section>
}


/** Only the recent window, as the native listening session delivers it. */
function streamWindow(seconds: number): InspectionSpectrogram {
  const times = STREAM.frameStartSeconds
  let first = 0, last = times.length
  while (first < times.length && times[first] < seconds - 12.5) first++
  while (last > first && times[last - 1] > seconds) last--
  return { ...STREAM, frameStartSeconds: times.slice(first, last), bins: STREAM.bins.slice(first, last) }
}

/** The Auto level meter: live level against the threshold an attempt must cross. */
function VoiceMeter({ active, seconds }: { active: boolean; seconds: number }) {
  const level = !active ? 6 : speaking(seconds) ? 62 + 14 * Math.sin(seconds * 7) ** 2 : 14 + 6 * Math.sin(seconds * 5) ** 2
  return <div className="dp-voice-meter" role="meter" aria-label="Microphone level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level)} title="Attempts start above the marker">
    <span className="dp-voice-meter-fill" style={{ width: `${level}%` }} data-above={level > 44} />
    <span className="dp-voice-meter-threshold" style={{ insetInlineStart: '44%' }} />
  </div>
}


function OptionRow({ label, values, value, onChange }: { label: string; values: string[]; value: string; onChange: (value: string) => void }) {
  return <div className="dp-option-row">
    <span className="dp-option-label">{label}</span>
    <div className="dp-segmented dp-segmented-wrap" role="radiogroup" aria-label={label}>
      {values.map(item => <button key={item} type="button" role="radio" aria-checked={item === value} onClick={() => onChange(item)}>{item}</button>)}
    </div>
  </div>
}

createRoot(document.getElementById('root')!).render(<Preview />)
