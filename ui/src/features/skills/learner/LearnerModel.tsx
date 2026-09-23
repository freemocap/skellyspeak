import { ErrorNotice } from '../../../components/feedback/ErrorNotice'
import { lensLabelKey } from '../../../domain/learning/catalog/evidence-labels'
import { useI18n } from '../../../components/localization/i18n'
import { YamlExport } from '../../../components/persistence/YamlExport'
import { nativeError } from '../../../platform/ipc/workspace'
import { useEffect, useRef, useState } from 'react'
import { getLearnerProfile, learnerStateYaml, saveLearnerState, type LearnerProfile } from '../../../platform/ipc/learner-profile'
import { saveSkillProfile } from '../../../platform/ipc/skill-evidence'
import { DetailDialog } from '../../../components/dialogs/DetailDialog'
import { useSkillEvidenceStore } from '../../../state/learning/skill-evidence'

export function LearnerModel({ target, onClose }: { target: string; onClose: () => void }) {
  const tr = useI18n()
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
  const skillLabel = (id: string) => {
    const node = data?.evidence.catalog.find(item => item.id === id)
    return node ? tr(node.label) : id
  }
  const states = data?.model.constructs.filter(item => variety === '*' || item.varietyId === variety) ?? []
  const lenses = [...new Set(states.map(item => data!.constructLenses[item.constructId]))].sort()
  const records = data?.evidence.records.filter(record => (variety === '*' || (record.variety ?? '') === variety) && record.assessment?.judgments.some(item => item.skill_id === selected)) ?? []
  if (yamlOpen) return <YamlExport title={tr("Learning evidence YAML")} scope={target} view={() => learnerStateYaml(target)} save={() => saveLearnerState(target)} onClose={() => setYamlOpen(false)} />
  return <DetailDialog size="wide" title={tr("Your learning evidence")} onClose={onClose}>
    <section className="learner-model">
      <h2>{tr("Your learning evidence")}</h2>
      <p>{tr("Estimates describe your recorded practice, separately from XP. They are experimental, not a proficiency certification.")}</p>
      {error && <ErrorNotice as="div" error={error}>{error}<button className="inspection-action" disabled={saving} onClick={() => refresh(value => value + 1)}>{tr("Reload evidence")}</button></ErrorNotice>}
      {!data && !error && <p role="status">{tr("Loading your evidence…")}</p>}
      <div className="learner-model-controls"><label>{tr("Partner ")}<select value={personaId ?? ''} disabled={saving} onChange={event => setPartnerSelection({ target, id: event.target.value || null })}><option value="">{tr("All partners")}</option>{(partnerOptions.target === target ? partnerOptions.items : []).map(partner => <option key={partner.personaId} value={partner.personaId}>{partner.name}{partner.archived ? tr(" (archived)") : ''}</option>)}</select></label>
        {data && <><label>{tr("Variety ")}<select value={variety} onChange={event => { setVariety(event.target.value); select(null) }}><option value="*">{tr("All varieties")}</option>{[...new Set([...data.model.constructs.map(item => item.varietyId), ...data.evidence.records.map(record => record.variety ?? '')])].sort().map(id => <option key={id} value={id}>{id || tr("Unspecified variety")}</option>)}</select></label><span>{data.evidence.profile.xp} {tr(" language-wide practice XP")}</span><span className="learner-model-export-actions"><button className="inspection-action" disabled={exporting || saving} onClick={() => setYamlOpen(true)}>{tr("View YAML")}</button><button className="inspection-action" disabled={exporting || saving} onClick={() => void exportEvidence()}>{exporting ? tr("Saving evidence…") : tr("Save YAML")}</button></span></>}
      </div>
      {data && <>
        {savedTo && <p role="status">{tr("Saved to ")}{savedTo}</p>}
        {!states.length && <p>{tr("No usable learning evidence yet. Missing evidence does not mean you lack the skill.")}</p>}
        <div className="learner-model-table"><table><caption>{tr("Learning estimates · ")}{target}</caption><thead><tr><th>{tr("Skill")}</th><th>{tr("Independent")}</th><th>{tr("Assisted")}</th><th>{tr("Estimate ± uncertainty")}</th><th>{tr("Last observed")}</th><th>{tr("Review")}</th></tr></thead>{lenses.map(lens => <tbody key={lens}><tr className="learner-model-lens"><th colSpan={6} scope="rowgroup">{tr(lensLabelKey(lens))}</th></tr>{states.filter(item => data.constructLenses[item.constructId] === lens).map(item => <tr key={`${item.varietyId}:${item.constructId}`}><th><button className="inspection-action" onClick={() => select(item.constructId)}>{skillLabel(item.constructId)}</button><small>{item.varietyId || tr("Unspecified variety")}</small></th><td>{tr.number(item.independentN)}</td><td>{tr.number(item.n - item.independentN)}</td><td>{item.insufficientEvidence ? tr("Not enough independent evidence") : `${tr.number(item.rating, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ± ${tr.number(item.uncertainty, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</td><td>{new Date(item.lastSeen * 1000).toLocaleDateString(tr.browserLocale)}</td><td>{item.insufficientEvidence ? '—' : item.due ? tr("Due for practice") : new Date(item.dueAt * 1000).toLocaleDateString(tr.browserLocale)}</td></tr>)}</tbody>)}</table></div>
        <label>{tr("Inspect evidence ")}<select value={selected ?? ''} onChange={event => select(event.target.value || null)}><option value="">{tr("Choose a skill")}</option>{data.evidence.catalog.filter(node => node.kind === 'skill').map(node => <option key={node.id} value={node.id}>{tr(node.label)}</option>)}</select></label>
        {selected && <section aria-label={tr("Source evidence")}><h3>{skillLabel(selected)}</h3><p>{tr("Excluding an attempt removes all its contributions to learning estimates and XP. You can restore it here.")}</p>{!records.length && <p>{tr("No recorded evidence for this skill.")}</p>}{records.map(record => {
          const judgment = record.assessment!.judgments.find(item => item.skill_id === selected)!
          const counted = states.some(item => item.constructId === selected && item.evidenceAttemptIds.includes(record.attempt_id))
          const excluded = data.evidence.profile.choices.excluded_attempts.includes(record.attempt_id)
          return <article className="practice-credit" key={record.attempt_id}><blockquote dir="auto">{record.source}</blockquote><p>{judgment.rationale}</p><small>{excluded ? tr("Excluded") : counted ? tr("Contributes to the selected estimates") : tr("Not used in the selected estimates")} · {new Date(record.at_secs * 1000).toLocaleDateString(tr.browserLocale)} {tr(" · Conversation ")}{record.chat_id}{record.replaces_message_id !== null && tr(" · Revised message")}</small><button className="inspection-action" disabled={saving} onClick={() => void exclude(record.attempt_id)}>{excluded ? tr("Restore attempt") : tr("Exclude attempt")}</button></article>
        })}</section>}
        <details><summary>{tr("Calculation details")}</summary><p>{tr("View YAML and Save YAML export this language across all partners and varieties, including source observations, focus and exclusion choices, estimates and configuration hashes. Save YAML writes the file to Downloads.")}</p><p>{tr("Rating is on an internal logistic scale, not a percentage or language level. Uncertainty is a heuristic, not a statistical confidence interval. Review dates are heuristic. Time changes when practice is due; it does not remove your rating or XP. Repeated wording is counted conservatively. Assisted includes recorded coaching support and revisions.")}</p><p>{tr("Estimator version ")}{data.model.estimatorVersion} {tr(" · calculated ")}{new Date(data.model.asOfSecs * 1000).toLocaleString(tr.browserLocale)}</p></details>
      </>}
    </section>
  </DetailDialog>
}
