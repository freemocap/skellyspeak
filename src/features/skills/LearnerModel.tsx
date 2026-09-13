import { YamlExport } from '../../ui/YamlExport'
import { nativeError } from '../../platform/ipc/workspace'
import { useEffect, useRef, useState } from 'react'
import { getLearnerProfile, learnerStateYaml, saveLearnerState, type LearnerProfile } from '../../platform/ipc/learner-profile'
import { saveSkillProfile } from '../../platform/skill-evidence'
import { DetailDialog } from '../../ui/DetailDialog'
import { useSkillEvidenceStore } from '../../state/skill-evidence'

export function LearnerModel({ target, onClose }: { target: string; onClose: () => void }) {
  const [data, setData] = useState<LearnerProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [partnerSelection, setPartnerSelection] = useState<{ target: string; id: string | null }>({ target, id: null })
  const personaId = partnerSelection.target === target ? partnerSelection.id : null
  const [partnerOptions, setPartnerOptions] = useState<{ target: string; items: LearnerProfile['partners'] }>({ target, items: [] })
  const profileOwner = JSON.stringify([target, personaId])
  const currentProfileOwner = useRef(profileOwner)
  currentProfileOwner.current = profileOwner
  const [revision, refresh] = useState(0)
  const [saving, setSaving] = useState(false)
  const [yamlOpen, setYamlOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [savedTo, setSavedTo] = useState<string | null>(null)
  const scope = useRef(target)
  scope.current = target
  async function exportEvidence() {
    if (exporting) return
    const owner = target
    setExporting(true); setSavedTo(null); setError(null)
    try {
      const path = await saveLearnerState(owner)
      if (scope.current === owner) setSavedTo(path)
    } catch (reason) { if (scope.current === owner) setError(nativeError(reason)) }
    finally { if (scope.current === owner) setExporting(false) }
  }
  const [variety, setVariety] = useState('*')
  const [selected, select] = useState<string | null>(null)
  useEffect(() => {
    let current = true
    setData(null); setError(null); setSavedTo(null); setExporting(false); setSaving(false)
    getLearnerProfile(target, personaId).then(result => {
      if (result.model.languageId !== target || result.evidence.target !== target || result.model.learnerId !== result.evidence.learner_id || result.scope.languageId !== target || result.scope.personaId !== personaId) throw new Error('Profile ownership mismatch')
      if (result.model.constructs.some(item => !result.constructLenses[item.constructId])) throw new Error('Profile construct lens is unavailable')
      if (current) { setData(result); setPartnerOptions({ target, items: result.partners }) }
    }).catch(reason => { if (current) setError(nativeError(reason)) })
    return () => { current = false }
  }, [target, personaId, revision])
  useEffect(() => { setVariety('*'); select(null) }, [target, personaId])
  async function exclude(attempt: string) {
    if (!data) return
    const owner = profileOwner
    setSaving(true); setError(null)
    const choices = data.evidence.profile.choices
    try {
      await saveSkillProfile({ ...choices, excluded_attempts: choices.excluded_attempts.includes(attempt) ? choices.excluded_attempts.filter(id => id !== attempt) : [...choices.excluded_attempts, attempt] })
      useSkillEvidenceStore.getState().reload()
      if (currentProfileOwner.current === owner) refresh(value => value + 1)
    } catch (reason) { if (currentProfileOwner.current === owner) setError(nativeError(reason)) }
    finally { if (currentProfileOwner.current === owner) setSaving(false) }
  }
  const states = data?.model.constructs.filter(item => variety === '*' || item.varietyId === variety) ?? []
  const lenses = [...new Set(states.map(item => data!.constructLenses[item.constructId]))].sort()
  const records = data?.evidence.records.filter(record => (variety === '*' || (record.variety ?? '') === variety) && record.assessment?.judgments.some(item => item.skill_id === selected)) ?? []
  if (yamlOpen) return <YamlExport title="Learning evidence YAML" scope={target} view={() => learnerStateYaml(target)} save={() => saveLearnerState(target)} onClose={() => setYamlOpen(false)} />
  return <DetailDialog title="Your learning evidence" onClose={onClose}>
    <section className="learner-model">
      <h2>Your learning evidence</h2>
      <p>Estimates describe your recorded practice, separately from XP. They are experimental, not a proficiency certification.</p>
      {error && <div role="alert">{error}<button disabled={saving} onClick={() => refresh(value => value + 1)}>Reload evidence</button></div>}
      {!data && !error && <p role="status">Loading your evidence…</p>}
      <div className="learner-model-controls"><label>Partner <select value={personaId ?? ''} disabled={saving} onChange={event => setPartnerSelection({ target, id: event.target.value || null })}><option value="">All partners</option>{(partnerOptions.target === target ? partnerOptions.items : []).map(partner => <option key={partner.personaId} value={partner.personaId}>{partner.name}{partner.archived ? ' (archived)' : ''}</option>)}</select></label>
        {data && <><label>Variety <select value={variety} onChange={event => { setVariety(event.target.value); select(null) }}><option value="*">All varieties</option>{[...new Set([...data.model.constructs.map(item => item.varietyId), ...data.evidence.records.map(record => record.variety ?? '')])].sort().map(id => <option key={id} value={id}>{id || 'Unspecified variety'}</option>)}</select></label><span>{data.evidence.profile.xp} language-wide practice XP</span><span className="learner-model-export-actions"><button disabled={exporting || saving} onClick={() => setYamlOpen(true)}>View YAML</button><button disabled={exporting || saving} onClick={() => void exportEvidence()}>{exporting ? 'Saving evidence…' : 'Save YAML'}</button></span></>}
      </div>
      {data && <>
        {savedTo && <p role="status">Saved to {savedTo}</p>}
        {!states.length && <p>No usable learning evidence yet. Missing evidence does not mean you lack the skill.</p>}
        <div className="learner-model-table"><table><caption>Learning estimates · {target}</caption><thead><tr><th>Skill</th><th>Independent</th><th>Assisted</th><th>Estimate ± uncertainty</th><th>Last observed</th><th>Review</th></tr></thead>{lenses.map(lens => <tbody key={lens}><tr className="learner-model-lens"><th colSpan={6} scope="rowgroup">{lens.charAt(0).toUpperCase() + lens.slice(1)}</th></tr>{states.filter(item => data.constructLenses[item.constructId] === lens).map(item => <tr key={`${item.varietyId}:${item.constructId}`}><th><button onClick={() => select(item.constructId)}>{data.evidence.catalog.find(node => node.id === item.constructId)?.label ?? item.constructId}</button><small>{item.varietyId || 'Unspecified variety'}</small></th><td>{item.independentN}</td><td>{item.n - item.independentN}</td><td>{item.insufficientEvidence ? 'Not enough independent evidence' : `${item.rating.toFixed(2)} ± ${item.uncertainty.toFixed(2)}`}</td><td>{new Date(item.lastSeen * 1000).toLocaleDateString()}</td><td>{item.insufficientEvidence ? '—' : item.due ? 'Due for practice' : new Date(item.dueAt * 1000).toLocaleDateString()}</td></tr>)}</tbody>)}</table></div>
        <label>Inspect evidence <select value={selected ?? ''} onChange={event => select(event.target.value || null)}><option value="">Choose a skill</option>{data.evidence.catalog.filter(node => node.kind === 'skill').map(node => <option key={node.id} value={node.id}>{node.label}</option>)}</select></label>
        {selected && <section aria-label="Source evidence"><h3>{data.evidence.catalog.find(node => node.id === selected)?.label}</h3><p>Excluding an attempt removes all its contributions to learning estimates and XP. You can restore it here.</p>{!records.length && <p>No recorded evidence for this skill.</p>}{records.map(record => {
          const judgment = record.assessment!.judgments.find(item => item.skill_id === selected)!
          const counted = states.some(item => item.constructId === selected && item.evidenceAttemptIds.includes(record.attempt_id))
          const excluded = data.evidence.profile.choices.excluded_attempts.includes(record.attempt_id)
          return <article className="practice-credit" key={record.attempt_id}><blockquote dir="auto">{record.source}</blockquote><p>{judgment.rationale}</p><small>{excluded ? 'Excluded' : counted ? 'Contributes to the selected estimates' : 'Not used in the selected estimates'} · {new Date(record.at_secs * 1000).toLocaleDateString()} · Conversation {record.chat_id}{record.replaces_message_id !== null && ' · Revised message'}</small><button disabled={saving} onClick={() => void exclude(record.attempt_id)}>{excluded ? 'Restore attempt' : 'Exclude attempt'}</button></article>
        })}</section>}
        <details><summary>Calculation details</summary><p>View YAML and Save YAML export this language across all partners and varieties, including source observations, focus and exclusion choices, estimates and configuration hashes. Save YAML writes the file to Downloads.</p><p>Rating is on an internal logistic scale, not a percentage or language level. Uncertainty is a heuristic, not a statistical confidence interval. Review dates are heuristic. Time changes when practice is due; it does not remove your rating or XP. Repeated wording is counted conservatively. Assisted includes recorded coaching support and revisions.</p><p>Estimator version {data.model.estimatorVersion} · calculated {new Date(data.model.asOfSecs * 1000).toLocaleString()}</p></details>
      </>}
    </section>
  </DetailDialog>
}
