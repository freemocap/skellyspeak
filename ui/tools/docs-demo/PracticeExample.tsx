import { useState } from 'react'
import { PhraseRail } from '../../src/features/drill/PhraseRail'
import { RecordDock, type RecordMode } from '../../src/features/drill/RecordDock'
import type { DrillItemView } from '../../src/generated/contracts'

const initialCards: DrillItemView[] = ['Quisiera un café, por favor.', '¿Dónde está la estación?'].map((text, index) => ({
  id: `sample-${index}`, text, language: 'spanish', variety: 'spanish-spain', explanation: 'english', explanationVariety: 'english-united-states',
  createdAt: '2026-10-01T12:00:00Z', source: { kind: 'own' }, attempts: [], attemptCount: 0, bestMatchRatio: null, lastAttemptAt: null,
}))

export function PracticeExample() {
  const [cards, setCards] = useState(initialCards)
  const [selected, setSelected] = useState(initialCards[0].id)
  const [mode, setMode] = useState<RecordMode>('tap')
  const [recording, setRecording] = useState(false)
  const [autoDetect, setAutoDetect] = useState(true)
  const [attempts, setAttempts] = useState<{ card: string; text: string }[]>([])
  const [settings, setSettings] = useState({ pauseMs: 900, thresholdDb: -40, minTakeMs: 400, silenceTimeoutMs: 1800 })
  const [notice, setNotice] = useState('Choose a card, then start and stop a simulated recording. Hold mode works with the pointer or Space key.')
  const card = cards.find(item => item.id === selected)
  function finish() {
    setRecording(false)
    if (!card) return
    if (mode === 'live' && !autoDetect) { setNotice('Detect attempts is off. The example stopped listening without adding an attempt.'); return }
    setAttempts(previous => [{ card: card.id, text: card.text }, ...previous])
    setCards(previous => previous.map(item => item.id === card.id ? { ...item, attemptCount: item.attemptCount + 1 } : item))
    setNotice('A fixed sample transcript was added. Real attempts compare recognized words with the card; a text match is not a pronunciation grade.')
  }
  return <>
    <h1>Repeat a practice card</h1><p className="docs-demo-explanation" role="status">{notice}</p>
    <div className="docs-demo-practice-grid">
      <PhraseRail items={cards} selectedId={selected} busy={false} locked={recording} onSelect={setSelected}
        onDelete={async item => { const remaining = cards.filter(value => value.id !== item.id); setCards(remaining); if (selected === item.id) setSelected(remaining[0]?.id ?? ''); setAttempts(previous => previous.filter(value => value.card !== item.id)) }}
        onAddPhrases={() => { setCards(initialCards); setSelected(initialCards[0].id); setAttempts([]) }}>
        <button className="btn" type="button" disabled={recording} onClick={() => { setCards(initialCards); setSelected(initialCards[0].id); setAttempts([]) }}>Restore sample cards</button>
      </PhraseRail>
      <div><div className="docs-demo-message"><strong>Selected card</strong><p lang="es">{card?.text ?? 'Restore sample cards to continue.'}</p><p>In the app, use the reference recording to hear the phrase before repeating it.</p></div>
        <RecordDock empty={!card} phase={recording ? 'recording' : 'ready'} mode={mode} onMode={setMode} settings={settings} onSettings={setSettings}
          listeningStatus={null} waveSource={null} spectrum={null} autoDetect={autoDetect} onAutoDetect={setAutoDetect}
          onToggle={() => recording ? finish() : setRecording(true)} onHoldStart={() => setRecording(true)} onHoldEnd={finish} />
        <p className="docs-demo-small">Tap starts and stops. Hold ends on release. Auto normally detects pauses; this example adds one fixed attempt when you stop.</p>
        <h2>Sample attempt history</h2>{attempts.filter(item => item.card === selected).length === 0 ? <p>No sample attempts for this card yet.</p>
          : <ol className="docs-demo-attempts">{attempts.filter(item => item.card === selected).map((attempt, index) => <li key={index}><details><summary>Sample transcript {attempts.filter(item => item.card === selected).length - index}</summary><p lang="es">{attempt.text}</p><p>Fixed transcript, not recognized speech. In the app, expand a take to inspect word comparisons and saved audio.</p></details></li>)}</ol>}
      </div>
    </div>
  </>
}
