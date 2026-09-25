import { useI18n } from '../../../components/localization/i18n'
import { TopBar } from '../../shell/TopBar'
import { DrillLayout } from '../../../features/drill/DrillLayout'
import { PhraseRail } from '../../../features/drill/PhraseRail'
import { RecordDock } from '../../../features/drill/RecordDock'
import { DrillComparison } from '../../../features/drill/DrillComparison'
import { AttemptInspection } from '../../../features/drill/AttemptInspection'
import { PhraseProgress } from '../../../features/drill/PhraseProgress'
import { DRILL_ATTEMPT_AUDIO, DRILL_ATTEMPTS, DRILL_PHRASE, DRILL_REFERENCE_AUDIO, DRILL_SECOND_PHRASE } from './fixtures'

const noop = () => {}
const asyncNoop = async () => {}
const attempt = DRILL_ATTEMPTS[0]
const items = [
  { source: { kind: 'own' as const }, attempts: [], id: DRILL_PHRASE.id, text: DRILL_PHRASE.text, language: 'arabic', variety: 'arabic-levantine',
    explanation: 'english', explanationVariety: 'english-united-states', createdAt: attempt.createdAt, attemptCount: DRILL_ATTEMPTS.length, bestMatchRatio: 0.93, lastAttemptAt: attempt.createdAt },
  { source: { kind: 'own' as const }, attempts: [], id: DRILL_SECOND_PHRASE.id, text: DRILL_SECOND_PHRASE.text, language: 'arabic', variety: 'arabic-levantine',
    explanation: 'english', explanationVariety: 'english-united-states', createdAt: attempt.createdAt, attemptCount: 0, bestMatchRatio: null, lastAttemptAt: null },
]

/// The Drill surface with one practised phrase already selected: the same
/// rail, recorder, comparison and history components the real page uses,
/// filled with a fixed take. Nothing here records, plays or calls native code.
export function DrillDemo() {
  const tr = useI18n()
  return <div className="demo-page">
    <TopBar />
    <section className="drill-page">
      <DrillLayout items={items} selectedId={DRILL_PHRASE.id} locked={false} onSelect={noop} attempt={attempt} rtl
        railResize={<div />} reportResize={<div />}
        progress={<PhraseProgress attempts={DRILL_ATTEMPTS} compact selectedId={attempt.id} onSelect={noop} />}
        rail={<PhraseRail items={items} selectedId={DRILL_PHRASE.id} languageTag="ar" busy={false} locked={false}
          onSelect={noop} onAdd={asyncNoop} onDelete={asyncNoop} onAskForMore={noop}>{null}</PhraseRail>}
        dock={<div className="drill-pane drill-dock-pane"><RecordDock phase="ready" mode="auto" onMode={noop} settings={{ pauseMs: 900, thresholdDb: -40, minTakeMs: 400, silenceTimeoutMs: 1800 }}
          onSettings={noop} listeningStatus={null} waveSource={null} liveSpectrum={null} onToggle={noop} onCancel={noop} onHoldStart={noop} onHoldEnd={noop} /></div>}
        report={<aside className="drill-log" aria-label={tr('Attempts')}>
          <div className="drill-pane drill-progress-pane"><PhraseProgress attempts={DRILL_ATTEMPTS} /></div>
          <div className="drill-pane drill-inspection-pane"><AttemptInspection attempt={attempt} audio={DRILL_ATTEMPT_AUDIO} reference={DRILL_REFERENCE_AUDIO} rtl onDelete={noop} deleting={false} /></div>
        </aside>}>
        <main className="drill-stage">
          <DrillComparison
            target={<div className="msg chat-message bot with-actions rtl"><span dir="auto">{DRILL_PHRASE.text}</span>
              <div className="message-actions"><button type="button" className="message-translate">{tr('Translate')}</button><button type="button" className="message-translate">{tr('Word by word')}</button></div></div>}
            playbackSpeed={<label className="drill-playback-speed"><span>{tr('Voice speed')}</span><select className="field" aria-label={tr('Voice speed')} value={1} onChange={noop}><option value={1}>1×</option></select></label>}
            onPlayReference={noop} playingReference={false} referenceNote={tr('Replays reuse the saved reference; no new request is made.')}
            reference={DRILL_REFERENCE_AUDIO} referenceTime={0.4} onSeekReference={noop}
            attempt={DRILL_ATTEMPT_AUDIO} attemptLabel={tr('Attempt {value0}', { value0: String(attempt.sequence) })} attemptFailure={null} onRetryAttempt={noop} attemptUnavailable={null}
            direction="ltr" onDirection={noop} timeScale="fit" onTimeScale={noop} holding={false} playingAttempt={false} onPlayAttempt={noop} />
        </main>
      </DrillLayout>
    </section>
  </div>
}
