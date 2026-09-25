import { useEffect, useRef, useState } from 'react'
import { ErrorNotice } from '../../../components/feedback/ErrorNotice'
import { useI18n } from '../../../components/localization/i18n'
import { YamlExport } from '../../../components/persistence/YamlExport'
import { nativeError } from '../../../platform/ipc/workspace'
import { getLearnerProfile, learnerStateYaml, saveLearnerState, type LearnerProfile } from '../../../platform/ipc/learner-profile'
import { saveSkillProfile } from '../../../platform/ipc/skill-evidence'
import { DetailDialog } from '../../../components/dialogs/DetailDialog'
import { useSkillEvidenceStore } from '../../../state/learning/skill-evidence'
import { ExperienceProfile } from './ExperienceProfile'
import { SkillDetailContent } from '../evidence/SkillDetailContent'

export function LearnerModel(props: { target: string; onClose: () => void }) {
  return <LiveLearnerProfile key={props.target} {...props} />
}

function LiveLearnerProfile({ target, onClose }: { target: string; onClose: () => void }) {
  const tr = useI18n()
  const published = useSkillEvidenceStore(state => state.snapshot)
  const [data, setData] = useState<LearnerProfile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [personaId, setPersonaId] = useState<string | null>(null)
  const [partners, setPartners] = useState<LearnerProfile['partners']>([])
  const [revision, reload] = useState(0)
  const [saving, setSaving] = useState(false)
  const [yamlOpen, setYamlOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [savedTo, setSavedTo] = useState<string | null>(null)
  const [variety, setVariety] = useState('*')
  const [selected, select] = useState<string | null>(null)
  const owner = JSON.stringify([target, personaId])
  const currentOwner = useRef<string | null>(owner)
  currentOwner.current = owner
  useEffect(() => () => { currentOwner.current = null }, [])
  useEffect(() => {
    let current = true
    setData(null); setError(null); setSaving(false)
    getLearnerProfile(target, personaId).then(result => {
      if (result.evidence.target !== target || result.evidence.profile.choices.target !== target || result.scope.languageId !== target || result.scope.personaId !== personaId) throw new Error('Profile ownership mismatch')
      if (current) { setData(result); setPartners(result.partners) }
    }).catch(reason => { if (current) setError(nativeError(reason)) })
    return () => { current = false }
  }, [target, personaId, revision, published])

  async function exclude(attempt: string) {
    if (!data || saving) return
    const captured = owner
    setSaving(true); setError(null)
    const choices = data.evidence.profile.choices
    try {
      await saveSkillProfile({ ...choices, excluded_attempts: choices.excluded_attempts.includes(attempt) ? choices.excluded_attempts.filter(id => id !== attempt) : [...choices.excluded_attempts, attempt] })
      useSkillEvidenceStore.getState().reload()
      if (currentOwner.current === captured) reload(value => value + 1)
    } catch (reason) { if (currentOwner.current === captured) setError(nativeError(reason)) }
    finally { if (currentOwner.current === captured) setSaving(false) }
  }
  async function exportEvidence() {
    if (exporting) return
    const captured = owner
    setExporting(true); setSavedTo(null); setError(null)
    try {
      const path = await saveLearnerState(target)
      if (currentOwner.current === captured) setSavedTo(path)
    } catch (reason) { if (currentOwner.current === captured) setError(nativeError(reason)) }
    finally { if (currentOwner.current === captured) setExporting(false) }
  }
  const visible = data?.scope.personaId === personaId ? data : null
  const node = visible?.evidence.catalog.find(item => item.kind === 'skill' && item.id === selected)
  if (yamlOpen) return <YamlExport title={tr('Learning evidence YAML')} scope={target} view={() => learnerStateYaml(target)} save={() => saveLearnerState(target)} onClose={() => setYamlOpen(false)} />
  return <DetailDialog size="wide" title={tr('Your learning evidence')} onClose={onClose}>
    <section className="learner-model">
      <h2>{tr('Your learning evidence')}</h2>
      {error && <ErrorNotice as="div" error={error}>{error}<button className="inspection-action" onClick={() => reload(value => value + 1)}>{tr('Reload evidence')}</button></ErrorNotice>}
      {!visible && !error && <p role="status">{tr('Loading your evidence…')}</p>}
      <div className="learner-model-controls">
        <label>{tr('Partner ')}<select value={personaId ?? ''} disabled={saving} onChange={event => { setPersonaId(event.target.value || null); select(null); setExporting(false); setSavedTo(null) }}>
          <option value="">{tr('All partners')}</option>{partners.map(partner => <option key={partner.personaId} value={partner.personaId}>{partner.name}{partner.archived ? tr(' (archived)') : ''}</option>)}
        </select></label>
        <span className="learner-model-export-actions">
          <button className="inspection-action" disabled={exporting || saving} onClick={() => setYamlOpen(true)}>{tr('View YAML')}</button>
          <button className="inspection-action" disabled={exporting || saving} onClick={() => void exportEvidence()}>{exporting ? tr('Saving evidence…') : tr('Save YAML')}</button>
        </span>
      </div>
      {savedTo && <p role="status">{tr('Saved to ')}{savedTo}</p>}
      {visible && <>
        <ExperienceProfile snapshot={visible.evidence} selectedVariety={variety} onVarietyChange={setVariety} onInspect={select} />
        {node && <SkillDetailContent variety={variety === '*' ? undefined : variety} node={node} snapshot={visible.evidence} chatId={null} explanation={null} controls={null} onSelect={select}
          recordControls={record => <button className="inspection-action" disabled={saving} onClick={() => void exclude(record.attempt_id)}>{visible.evidence.profile.choices.excluded_attempts.includes(record.attempt_id) ? tr('Restore attempt') : tr('Exclude attempt')}</button>} />}
      </>}
    </section>
  </DetailDialog>
}
