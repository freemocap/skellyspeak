import { memo, useEffect, useRef } from 'react'
import type { CoachFeedback } from '../../types'
import { Markdown } from '../../lib/markdown'

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
function CoachEntry({
  turn,
  targetLangCode,
  nativeLangCode,
}: {
  turn: TurnForCoach
  targetLangCode: string
  nativeLangCode: string
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
            <p className="coach-remark">
              <Markdown text={turn.coach.remark} />
            </p>
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
              <p className="cor-why">
                <Markdown text={cor.explanation} />
              </p>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

/// Per-message coaching, kept for every message that has earned it — not just
/// the latest. The coach's read on turn 3 is still worth having on screen
/// when you're on turn 9; overwriting it every message threw away exactly
/// the record a learner would want to scroll back through.
export const CoachFeed = memo(function CoachFeed({
  turns,
  targetLangCode,
  nativeLangCode,
}: {
  turns: TurnForCoach[]
  targetLangCode: string
  nativeLangCode: string
}) {
  const coached = turns.filter((t) => t.user !== null && (t.coach || t.coachError))
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // New feedback lands at the bottom — follow it, the way the chat itself does.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [coached.length])

  if (coached.length === 0) {
    return (
      <div className="break-scroll coach-feed">
        <p className="center-note">Say something — your coach will weigh in here.</p>
      </div>
    )
  }
  return (
    <div className="break-scroll coach-feed" ref={scrollRef}>
      {coached.map((turn) => (
        <CoachEntry
          key={turn.id}
          turn={turn}
          targetLangCode={targetLangCode}
          nativeLangCode={nativeLangCode}
        />
      ))}
    </div>
  )
})
