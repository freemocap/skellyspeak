import { memo } from 'react'

export interface TurnForCoach {
  user: string | null
  coach?: { comprehensibility: number; grammar: number; remark: string; used_target: string[]; used_native: string[]; corrections: { said: string; corrected: string; kind: string; explanation: string }[] }
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

/// Per-message coaching for the latest learner message.
export const CoachFeed = memo(function CoachFeed({
  turns,
  targetLangCode,
  nativeLangCode,
}: {
  turns: TurnForCoach[]
  targetLangCode: string
  nativeLangCode: string
}) {
  const latest = [...turns]
    .reverse()
    .find((t) => t.user !== null && (t.coach || t.coachError))

  if (!latest) {
    return (
      <div className="break-scroll coach-feed">
        <p className="center-note">Say something — your coach will weigh in here.</p>
      </div>
    )
  }
  if (latest.coachError) {
    return (
      <div className="break-scroll coach-feed">
        <div className="turn-errors">⚠ {latest.coachError}</div>
      </div>
    )
  }
  const c = latest.coach
  if (!c) {
    return (
      <div className="break-scroll coach-feed">
        <p className="center-note">⟳ Coach is listening…</p>
      </div>
    )
  }
  return (
    <div className="break-scroll coach-feed">
      <div className="coach-card">
        <div className="coach-scores">
          <ScoreMeter label="Understood" value={c.comprehensibility} />
          <ScoreMeter label="Grammar" value={c.grammar} />
        </div>
        <p className="coach-remark">{c.remark}</p>
        {(c.used_target.length > 0 || c.used_native.length > 0) && (
          <div className="coach-split">
            {c.used_target.length > 0 && (
              <div className="split-row">
                <span className="split-k target">{targetLangCode.toUpperCase()}</span>
                <span>{c.used_target.join(' · ')}</span>
              </div>
            )}
            {c.used_native.length > 0 && (
              <div className="split-row">
                <span className="split-k native">{nativeLangCode.toUpperCase()}</span>
                <span>{c.used_native.join(' · ')}</span>
              </div>
            )}
          </div>
        )}
      </div>
      {c.corrections.length > 0 && (
        <p className="sect-k" style={{ marginTop: 14 }}>
          Corrections
        </p>
      )}
      {c.corrections.map((cor, i) => (
        <div key={i} className="coach-correction">
          <div className="cor-line">
            <s>{cor.said}</s> <span className="cor-arrow">→</span>{' '}
            <b>{cor.corrected}</b> <span className="cor-kind">{cor.kind}</span>
          </div>
          <p className="cor-why">{cor.explanation}</p>
        </div>
      ))}
    </div>
  )
})
