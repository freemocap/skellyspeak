import { useI18n } from '../../components/localization/i18n'
import { EvidenceMappingNotice } from '../../components/learning/EvidenceMappingNotice'
import { SkillList } from '../../components/learning/SkillList'
import { ProgressRules } from './learner/ProgressRules'
import { DetailDialog } from '../../components/dialogs/DetailDialog'
import { SkillDetailContent } from './evidence/SkillDetailContent'
import { useSkillNavigationStore } from '../../state/navigation/skill-navigation'
import { useState } from 'react'
import { useSkillEvidence } from '../../state/learning/useSkillEvidence'
import { isTauri, languageFor } from '../../platform/ipc/tauri'
import { skillDemo } from '../../domain/learning/catalog/skillDemo'
import type { ProfileChoices, SkillSnapshot } from '../../domain/learning/evidence/skills'

export default function SkillsPage({ onPractice }: { onPractice: () => void }) {
  const tr = useI18n()
  const evidence = useSkillEvidence()
  if (isTauri && evidence.error) return <div role="alert">{evidence.error}<button onClick={evidence.reload}>{tr('Retry')}</button></div>
  if (isTauri && !evidence.snapshot) return <p role="status">{tr('Loading your language profile…')}</p>
  return <SkillListView languageTag={isTauri && evidence.snapshot ? languageFor(evidence.snapshot.target)?.languageTag : undefined} snapshot={isTauri ? evidence.snapshot! : skillDemo} demonstration={!isTauri} refresh={evidence.reload} save={evidence.save} saving={evidence.saving} onPractice={onPractice} />
}
export function SkillListView({ languageTag, snapshot, demonstration, refresh, save, saving, onPractice }: {
  languageTag?: string; snapshot: SkillSnapshot; demonstration: boolean; refresh: () => void; save: (choices: ProfileChoices) => Promise<void>; saving: boolean; onPractice: () => void
}) {
  const tr = useI18n()
  const picked = useSkillNavigationStore(state => state.selected)
  const select = useSkillNavigationStore(state => state.select)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selected = picked?.target === snapshot.target ? picked.skillId : undefined
  const node = snapshot.catalog.find(n => n.kind === 'skill' && n.id === selected)
  function inspect(id: string) { select({target:snapshot.target,skillId:id}); setOpen(true) }
  async function update(choices: ProfileChoices, practice = false) {
    setError(null)
    try { await save(choices); if (practice) onPractice() } catch (e) { setError(String(e)) }
  }
  return <main className="skills-page">
    <header className="tree-header"><h1>{tr('Skills')} · {snapshot.target}</h1><strong>{tr.number(snapshot.profile.xp)} XP</strong><button onClick={refresh}>{tr('Refresh')}</button></header>
    {demonstration && <p>{tr('DEMO · SAMPLE DATA')}</p>}
    <EvidenceMappingNotice snapshot={snapshot} />
    {error && <p role="alert">{error}</p>}
    <SkillList key={snapshot.target} snapshot={snapshot} selected={selected} onSelect={inspect} />
    <ProgressRules />
    {open && node && <DetailDialog title={tr(node.label)} onClose={() => setOpen(false)}>
      <SkillDetailContent languageTag={languageTag} node={node} snapshot={snapshot} chatId={null} explanation={null} onSelect={inspect}
        controls={<button disabled={saving || demonstration} onClick={() => void update({...snapshot.profile.choices,focus:node.id},true)}>{tr('Practise this in conversation')}</button>}
        recordControls={record => <button disabled={saving || demonstration} onClick={() => void update({...snapshot.profile.choices,excluded_attempts:snapshot.profile.choices.excluded_attempts.includes(record.attempt_id) ? snapshot.profile.choices.excluded_attempts.filter(id => id !== record.attempt_id) : [...snapshot.profile.choices.excluded_attempts,record.attempt_id]})}>{snapshot.profile.choices.excluded_attempts.includes(record.attempt_id) ? tr('Excluded · restore attempt') : tr('Exclude attempt from progress')}</button>} />
    </DetailDialog>}
  </main>
}
