import { TargetText } from '../TargetText'
import type { Feedback } from '../../contracts'
import { Markdown, type TermHandler } from '../../lib/markdown'
import catalog from '../../assets/skill-catalogs/catalog.json'

/// The parts of a turn the coach feedback renders.
export interface TurnForCoach {
  id: number
  user: string | null
  coach?: Feedback
  coachError?: string
}

const skillLabels = new Map(catalog.filter(node => node.kind === 'skill').map(node => [node.id, node.label]))
function skillLabel(id: string): string {
  const label = skillLabels.get(id)
  if (!label) throw new Error(`Coach feedback cites an unknown skill: ${id}`)
  return label
}

const OUTCOMES: Record<string, string> = { demonstrated: 'Shown', partial: 'Partly shown', uncertain: 'Unclear' }
function outcomeLabel(outcome: string): string {
  const label = OUTCOMES[outcome]
  if (!label) throw new Error(`Coach feedback has an unknown outcome: ${outcome}`)
  return label
}

function ScoreMeter({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="score-meter">
      <span className="score-label">{label}</span>
      <span className="score-dots">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={value !== null && n <= value ? 'dot on' : 'dot'}>
            ●
          </span>
        ))}
      </span>
      <span className="score-num">{value === null ? '—' : `${value}/5`}</span>
    </div>
  )
}

/// Everything the coach saved about one learner message.
export function CoachEntry({ turn, onTerm }: { turn: TurnForCoach; onTerm?: TermHandler }) {
  const coach = turn.coach
  return (
    <div className="coach-entry">
      {turn.user && <p className="coach-entry-said">“<TargetText text={turn.user} />”</p>}
      {turn.coachError && <div className="turn-errors">⚠ {turn.coachError}</div>}
      {!turn.coachError && !coach && <p className="center-note">⟳ Coach is listening…</p>}
      {coach && (
        <>
          <div className="coach-card">
            <div className="coach-scores">
              <ScoreMeter label="Correctness" value={coach.correctness} />
              <ScoreMeter label="Understandability" value={coach.understandability} />
            </div>
            {coach.explanation.trim() && <div className="coach-remark"><Markdown text={coach.explanation} onTerm={onTerm} /></div>}
          </div>
          {coach.correction.trim() && (
            <div className="coach-correction">
              <span className="cor-kind">Suggested version</span>
              <div className="cor-line"><b><TargetText text={coach.correction} /></b></div>
            </div>
          )}
          {coach.evidence.length > 0 && (
            <section className="coach-evidence" aria-label="What this message shows">
              <span className="cor-kind">What this message shows</span>
              <ul>
                {coach.evidence.map(item => (
                  <li key={item.skill_id}>
                    <div className="evidence-head"><strong>{skillLabel(item.skill_id)}</strong> <span className={`evidence-outcome ${item.outcome}`}>{outcomeLabel(item.outcome)}</span></div>
                    <div className="evidence-quote">“<TargetText text={item.quote} />”</div>
                    <div className="cor-why">{item.rationale}</div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
