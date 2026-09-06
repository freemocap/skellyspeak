import type { CoachFeedback } from '../../types'
import { Markdown, type TermHandler } from '../../lib/markdown'

/// The parts of a turn the coach feed renders.
export interface TurnForCoach {
  id: number
  user: string | null
  coach?: CoachFeedback
  coachError?: string
}

function ScoreMeter({ label, value }: { label: string; value: number }) {
  return (
    <div className="score-meter">
      <span className="score-label">{label}</span>
      <span className="score-dots">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={n <= value ? 'dot on' : 'dot'}>
            ●
          </span>
        ))}
      </span>
      <span className="score-num">{value}/5</span>
    </div>
  )
}

/// One turn's worth of coaching: the learner's line, for context, plus
/// whatever the coach made of it.
export function CoachEntry({
  turn,
  targetLangCode,
  nativeLangCode,
  onTerm,
}: {
  turn: TurnForCoach
  targetLangCode: string
  nativeLangCode: string
  onTerm?: TermHandler
}) {
  return (
    <div className="coach-entry">
      {turn.user && <p className="coach-entry-said">“{turn.user}”</p>}
      {turn.coachError && <div className="turn-errors">⚠ {turn.coachError}</div>}
      {!turn.coachError && !turn.coach && <p className="center-note">⟳ Coach is listening…</p>}
      {turn.coach && (
        <>
          <div className="coach-card">
            <div className="coach-scores">
              <ScoreMeter label="Understood" value={turn.coach.comprehensibility} />
              <ScoreMeter label="Grammar" value={turn.coach.grammar} />
            </div>
            <div className="coach-remark">
              <Markdown text={turn.coach.remark} onTerm={onTerm} />
            </div>
            {(turn.coach.used_target.length > 0 || turn.coach.used_native.length > 0) && (
              <div className="coach-split">
                {turn.coach.used_target.length > 0 && (
                  <div className="split-row">
                    <span className="split-k target">{targetLangCode.toUpperCase()}</span>
                    <span>{turn.coach.used_target.join(' · ')}</span>
                  </div>
                )}
                {turn.coach.used_native.length > 0 && (
                  <div className="split-row">
                    <span className="split-k native">{nativeLangCode.toUpperCase()}</span>
                    <span>{turn.coach.used_native.join(' · ')}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          {turn.coach.corrections.map((cor, i) => (
            <div key={i} className="coach-correction">
              <div className="cor-line">
                <s>{cor.said}</s> <span className="cor-arrow">→</span>{' '}
                <b>{cor.corrected}</b> <span className="cor-kind">{cor.kind}</span>
              </div>
              <div className="cor-why">
                <Markdown text={cor.explanation} />
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

