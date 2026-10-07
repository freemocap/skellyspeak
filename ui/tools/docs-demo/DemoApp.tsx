import { useState } from 'react'
import { ToolbarIcon, type ToolbarIconName } from '../../src/components/controls/ToolbarIcon'
import { ChatExample } from './ChatExample'
import { PracticeExample } from './PracticeExample'
import { ProgressExample, SkillsExample } from './ProgressExample'

const destinations = [
  { id: 'chat', label: 'Chat', icon: 'chat', detail: 'Talk with a conversation partner. Open the coach beside a message for feedback and reply help.' },
  { id: 'practice', label: 'Practice', icon: 'practice', detail: 'Choose a saved phrase, listen to its reference in the app, and record repeated attempts.' },
  { id: 'progress', label: 'Progress', icon: 'skills', detail: 'Inspect activity and language progress. Counts describe recorded actions; skill levels describe credited evidence.' },
  { id: 'skills', label: 'Skills', icon: 'reading', detail: 'Select a skill in the language chart to see what it covers and the evidence that counts.' },
] as const
type View = typeof destinations[number]['id'] | 'navigation'

function isView(value: string | null): value is View {
  return value === 'navigation' || destinations.some(item => item.id === value)
}

export function DemoApp({ initialView }: { initialView?: View }) {
  const query = new URLSearchParams(window.location.search).get('view')
  const [view, setView] = useState<View>(initialView ?? (isView(query) ? query : 'navigation'))
  const [revision, setRevision] = useState(0)
  return <main className="docs-demo">
    <header className="docs-demo-banner">
      <div><strong>Interactive example</strong><span>Fixed examples. Nothing is recorded, sent, or saved.</span></div>
      <button type="button" className="btn" onClick={() => setRevision(value => value + 1)}>Reset example</button>
    </header>
    <nav className="docs-demo-nav" aria-label="Choose an example">
      <button type="button" className="btn" aria-current={view === 'navigation' ? 'page' : undefined} onClick={() => setView('navigation')}><ToolbarIcon name="menu" />Navigation</button>
      {destinations.map(item => <button type="button" className="btn" key={item.id} aria-current={view === item.id ? 'page' : undefined} onClick={() => setView(item.id)}><ToolbarIcon name={item.icon} />{item.label}</button>)}
    </nav>
    <section className="docs-demo-content" key={`${view}:${revision}`} aria-label={`${view} example`}>
      {view === 'navigation' && <>
        <h1>Find your way around</h1>
        <p>The SkellySpeak wordmark returns to Chat. Practice and Progress are destinations in the top bar. Try the simplified bar below to learn where each control leads.</p>
        <NavigationExample onView={setView} />
        <div className="docs-demo-destinations">{destinations.filter(item => item.id !== 'skills').map(item => <button type="button" key={item.id} onClick={() => setView(item.id)}><ToolbarIcon name={item.icon} size={26} /><strong>{item.label}</strong><span>{item.detail}</span></button>)}</div>
        <h2>Learn the icons</h2><IconExplorer />
      </>}
      {view === 'chat' && <ChatExample />}
      {view === 'practice' && <PracticeExample />}
      {view === 'progress' && <ProgressExample onSkills={() => setView('skills')} />}
      {view === 'skills' && <SkillsExample />}
    </section>
  </main>
}

const tools: { icon: ToolbarIconName; label: string; detail: string }[] = [
  { icon: 'translate', label: 'Translation', detail: 'Show a translation of the message into your explanation language.' },
  { icon: 'words', label: 'Word meanings', detail: 'Inspect meanings and reading assistance for words in the message.' },
  { icon: 'voice', label: 'Read aloud', detail: 'Play speech for the selected text. The examples here do not play audio.' },
  { icon: 'pronunciation', label: 'Pronunciation', detail: 'Show written pronunciation notation. This is separate from the speaker button, which plays audio.' },
  { icon: 'deck-add', label: 'Add to Practice', detail: 'Save a useful phrase as a card to repeat in Practice.' },
  { icon: 'coach', label: 'Coach', detail: 'Open coaching for a message: feedback, explanations, and help with a reply.' },
  { icon: 'skills', label: 'Progress', detail: 'Open language progress. The Skills and XP tabs show different parts of the record.' },
  { icon: 'settings', label: 'Conversation settings', detail: 'Adjust the current conversation. This sliders icon is different from the app-wide Settings cog.' },
  { icon: 'cog', label: 'Settings', detail: 'Open controls for appearance, audio, languages, AI access, and the workspace.' },
]
function IconExplorer() {
  const [selected, setSelected] = useState(tools[0])
  return <>
    <div className="docs-demo-icon-list">{tools.map(tool => <button type="button" className="btn" key={tool.icon} aria-pressed={selected === tool} onClick={() => setSelected(tool)}><ToolbarIcon name={tool.icon} />{tool.label}</button>)}</div>
    <p className="docs-demo-explanation" role="status"><strong>{selected.label}: </strong>{selected.detail}</p>
  </>
}

function NavigationExample({ onView }: { onView: (view: View) => void }) {
  const [detail, setDetail] = useState('Choose a top-bar control to see its destination.')
  const [more, setMore] = useState(false)
  return <section className="docs-demo-shell-example" aria-label="Simplified app navigation">
    <div className="docs-demo-icon-list">
      <button type="button" className="btn" onClick={() => onView('chat')} aria-label="SkellySpeak home — Chat"><strong>SkellySpeak</strong></button>
      <button type="button" className="btn" onClick={() => setDetail('The language picker changes the active learning language. Your explanation language is configured separately. This example keeps Spanish selected.')}><ToolbarIcon name="globe" />Español ▾</button>
      <button type="button" className="btn" onClick={() => onView('practice')}><ToolbarIcon name="practice" />Practice</button>
      <button type="button" className="btn" onClick={() => onView('progress')}><ToolbarIcon name="skills" />Progress</button>
      <button type="button" className="btn" onClick={() => onView('skills')}>Lv 0</button>
      <button type="button" className="btn" onClick={() => onView('progress')}>ES · 0 XP</button>
      <button type="button" className="btn" onClick={() => setDetail('Settings opens app-wide preferences: appearance, audio, language, AI access, and workspace controls. On narrow screens, find Settings under More.')}><ToolbarIcon name="cog" />Settings</button>
      <button type="button" className="btn" aria-expanded={more} onClick={() => setMore(value => !value)}><ToolbarIcon name="more" />More</button>
    </div>
    {more && <div className="docs-demo-icon-list" aria-label="More destinations">{['Share logs', 'Settings', 'Browse languages', 'Progress', 'AI activity', 'Reload app'].map(label => <button type="button" className="btn" key={label} onClick={() => label === 'Progress' ? onView('skills') : setDetail(`${label} is available from More in the app. This example explains the destination without opening account, device, or workspace tools.`)}>{label}</button>)}</div>}
    <p className="docs-demo-explanation" role="status">{detail}</p>
  </section>
}
