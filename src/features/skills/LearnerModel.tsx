import { nativeError } from '../../platform/ipc/workspace'
import { useEffect, useState } from 'react'
import { getLearnerProfile, type LearnerProfile } from '../../platform/ipc/learner-profile'
import { saveSkillProfile } from '../../platform/skill-evidence'
import { DetailDialog } from '../../ui/DetailDialog'
import { useSkillEvidenceStore } from '../../state/skill-evidence'

export function LearnerModel({ target, onClose }: { target: string; onClose: () => void }) {
  const [data, setData] = useState<LearnerProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [revision, refresh] = useState(0)
  const [saving, setSaving] = useState(false)
  const [variety, setVariety] = useState('*')
  const [selected, select] = useState<string | null>(null)
  useEffect(() => {
    let current = true
    setData(null); setError(null)
    getLearnerProfile(target).then(result => {
      if (result.model.languageId !== target || result.evidence.target !== target || result.model.learnerId !== result.evidence.learner_id) throw new Error('Profile ownership mismatch')
      if (current) setData(result)
    }).catch(reason => { if (current) setError(nativeError(reason)) })
    return () => { current = false }
  }, [target, revision])
  async function exclude(attempt: string) {
    if (!data) return
    setSaving(true); setError(null)
    const choices = data.evidence.profile.choices
    try {
      await saveSkillProfile({ ...choices, excluded_attempts: choices.excluded_attempts.includes(attempt) ? choices.excluded_attempts.filter(id => id !== attempt) : [...choices.excluded_attempts, attempt] })
      useSkillEvidenceStore.getState().reload()
      refresh(value => value + 1)
    } catch (reason) { setError(nativeError(reason)) }
    finally { setSaving(false) }
  }
  const states = data?.model.constructs.filter(item => variety === '*' || item.varietyId === variety) ?? []
  const records = data?.evidence.records.filter(record => (variety === '*' || (record.variety ?? '') === variety) && record.assessment?.judgments.some(item => item.skill_id === selected)) ?? []
  return <DetailDialog title="Your learning evidence" onClose={onClose}>
    <section className="learner-model">
      <h2>Your learning evidence</h2>
      <p>Estimates describe your recorded practice, separately from XP. They are experimental, not a proficiency certification.</p>
      {error && <div role="alert">{error}<button disabled={saving} onClick={() => refresh(value => value + 1)}>Reload evidence</button></div>}
      {!data && !error && <p role="status">Loading your evidence…</p>}
      {data && <>
        <div className="learner-model-controls"><label>Variety <select value={variety} onChange={event => { setVariety(event.target.value); select(null) }}><option value="*">All varieties</option>{[...new Set([...data.model.constructs.map(item => item.varietyId), ...data.evidence.records.map(record => record.variety ?? '')])].sort().map(id => <option key={id} value={id}>{id || 'Unspecified variety'}</option>)}</select></label><span>{data.evidence.profile.xp} practice XP</span></div>
        {!states.length && <p>No usable learning evidence yet. Missing evidence does not mean you lack the skill.</p>}
        <div className="learner-model-table"><table><caption>Learning estimates · {target}</caption><thead><tr><th>Skill</th><th>Independent</th><th>Assisted</th><th>Estimate ± uncertainty</th><th>Last observed</th><th>Review</th></tr></thead><tbody>{states.map(item => <tr key={`${item.varietyId}:${item.constructId}`}><th><button onClick={() => select(item.constructId)}>{data.evidence.catalog.find(node => node.id === item.constructId)?.label ?? item.constructId}</button><small>{item.varietyId || 'Unspecified variety'}</small></th><td>{item.independentN}</td><td>{item.n - item.independentN}</td><td>{item.insufficientEvidence ? 'Not enough independent evidence' : `${item.rating.toFixed(2)} ± ${item.uncertainty.toFixed(2)}`}</td><td>{new Date(item.lastSeen * 1000).toLocaleDateString()}</td><td>{item.insufficientEvidence ? '—' : item.due ? 'Due for practice' : new Date(item.dueAt * 1000).toLocaleDateString()}</td></tr>)}</tbody></table></div>
        <label>Inspect evidence <select value={selected ?? ''} onChange={event => select(event.target.value || null)}><option value="">Choose a skill</option>{data.evidence.catalog.filter(node => node.kind === 'skill').map(node => <option key={node.id} value={node.id}>{node.label}</option>)}</select></label>
        {selected && <section aria-label="Source evidence"><h3>{data.evidence.catalog.find(node => node.id === selected)?.label}</h3><p>Excluding an attempt removes all its contributions to learning estimates and XP. You can restore it here.</p>{!records.length && <p>No recorded evidence for this skill.</p>}{records.map(record => {
          const judgment = record.assessment!.judgments.find(item => item.skill_id === selected)!
          const counted = states.some(item => item.constructId === selected && item.evidenceAttemptIds.includes(record.attempt_id))
          const excluded = data.evidence.profile.choices.excluded_attempts.includes(record.attempt_id)
          return <article className="practice-credit" key={record.attempt_id}><blockquote dir="auto">{record.source}</blockquote><p>{judgment.rationale}</p><small>{excluded ? 'Excluded' : counted ? 'Contributes to the selected estimates' : 'Not used in the selected estimates'} · {new Date(record.at_secs * 1000).toLocaleDateString()} · Conversation {record.chat_id}{record.replaces_message_id !== null && ' · Revised message'}</small><button disabled={saving} onClick={() => void exclude(record.attempt_id)}>{excluded ? 'Restore attempt' : 'Exclude attempt'}</button></article>
        })}</section>}
        <details><summary>Calculation details</summary><p>Rating is on an internal logistic scale, not a percentage or language level. Uncertainty is a heuristic, not a statistical confidence interval. Review dates are heuristic. Time changes when practice is due; it does not remove your rating or XP. Repeated wording is counted conservatively. Assisted includes recorded coaching support and revisions.</p><p>Estimator version {data.model.estimatorVersion} · calculated {new Date(data.model.asOfSecs * 1000).toLocaleString()}</p></details>
      </>}
    </section>
  </DetailDialog>
}
