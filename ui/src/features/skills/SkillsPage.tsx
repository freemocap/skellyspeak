import { ExperienceProfile } from './learner/ExperienceProfile'
import { useSettingsStore } from '../../state/settings/settings'
import { ErrorNotice } from '../../components/feedback/ErrorNotice'
import { errorMessage } from '../../platform/diagnostics/error-details'
import { useI18n } from '../../components/localization/i18n'
import { EvidenceMappingNotice } from '../../components/learning/EvidenceMappingNotice'
import { SkillLevelsPanel } from '../../components/learning/SkillLevelsPanel'
import { ProgressRules } from './learner/ProgressRules'
import { SkillDetailContent } from './evidence/SkillDetailContent'
import { useSkillNavigationStore } from '../../state/navigation/skill-navigation'
import { useEffect, useRef, useState } from 'react'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import { usePersistentToggle } from '../../components/persistence/usePersistentToggle'
import { SkillsIntro } from './SkillsIntro'
import { useSkillEvidence } from '../../state/learning/useSkillEvidence'
import { isTauri, languageFor } from '../../platform/ipc/tauri'
import { skillDemo } from '../../domain/learning/catalog/skillDemo'
import type { ProfileChoices, SkillSnapshot } from '../../domain/learning/evidence/skills'

export default function SkillsPage({ onPractice }: { onPractice: (language: string, variety: string, skillId: string) => Promise<void> }) {
  const tr = useI18n()
  const evidence = useSkillEvidence()
  const variety = useSettingsStore(state => state.settings?.target_variety)
  // Opens on the first visit; after that only from "How skills work".
  const firstVisit = usePersistentToggle('skellyspeak_skills_intro', true)
  const [explaining, setExplaining] = useState(false)
  const closeIntro = () => { if (firstVisit.open) firstVisit.toggle(); setExplaining(false) }
  if (isTauri && evidence.error) return <ErrorNotice as="div" error={evidence.error}>{evidence.error}<button onClick={evidence.reload}>{tr('Retry')}</button></ErrorNotice>
  if (isTauri && !evidence.snapshot) return <p role="status">{tr('Loading your language profile…')}</p>
  const language = isTauri && evidence.snapshot ? languageFor(evidence.snapshot.target) : null
  return <>{(firstVisit.open || explaining) && <SkillsIntro onClose={closeIntro} />}<SkillListView onExplain={() => setExplaining(true)} initialVariety={variety} languageName={language?.name} languageTag={language?.languageTag ?? undefined} snapshot={isTauri ? evidence.snapshot! : skillDemo} demonstration={!isTauri} refresh={evidence.reload} save={evidence.save} saving={evidence.saving} onPractice={onPractice} /></>
}
/** The Skills page: the language's practice level, its skills and what each
 * one needs next, with XP by skill (Experience and Effort) folded underneath.
 * Opening a skill replaces the overview with that skill's page: its guide and
 * the reviewed replies for it. */
export function SkillListView({ initialVariety, languageName, languageTag, snapshot, demonstration, save, saving, onPractice, onExplain }: {
  onExplain: () => void; initialVariety?: string; languageName?: string; languageTag?: string; snapshot: SkillSnapshot; demonstration: boolean; refresh: () => void; save: (choices: ProfileChoices) => Promise<void>; saving: boolean; onPractice: (language: string, variety: string, skillId: string) => Promise<void>
}) {
  const tr = useI18n()
  const picked = useSkillNavigationStore(state => state.selected)
  const select = useSkillNavigationStore(state => state.select)
  const [inspectedVariety, setInspectedVariety] = useState<string | undefined>(initialVariety)
  const [open, setOpen] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selected = picked?.target === snapshot.target ? picked.skillId : undefined
  const node = snapshot.catalog.find(n => n.kind === 'skill' && n.id === selected)
  const page = useRef<HTMLElement>(null)
  const detail = open && node ? node : null
  // A skill page and the overview are separate views: each starts at its top.
  useEffect(() => { page.current?.scrollTo?.({ top: 0 }) }, [detail?.id])
  function inspect(id: string, variety?: string) { setInspectedVariety(variety); select({target:snapshot.target,skillId:id}); setOpen(true) }
  async function update(choices: ProfileChoices) {
    setError(null)
    try { await save(choices) } catch (e) { setError(errorMessage(e)) }
  }
  async function practice(skillId: string) {
    if (starting) return
    setStarting(true); setError(null)
    try {
      const variety = inspectedVariety ?? initialVariety
      if (!variety) throw new Error('Select a language variety before starting.')
      await onPractice(snapshot.target, variety, skillId)
      setOpen(false)
    } catch (e) { setError(errorMessage(e)) }
    finally { setStarting(false) }
  }
  return <main className="skills-page" ref={page}>
    {detail ? <section className="skill-detail-page" aria-label={tr(detail.label)}>
      <button type="button" className="btn return-to-conversation skill-detail-back" onClick={() => setOpen(false)}><ToolbarIcon name="back" /><span>{tr('All skills')}</span></button>
      {error && <ErrorNotice as="p" error={error}>{error}</ErrorNotice>}
      <SkillDetailContent variety={inspectedVariety} languageTag={languageTag} node={detail} snapshot={snapshot} chatId={null} explanation={null} onSelect={inspect} guideOpen
        controls={<button className="btn primary" disabled={starting || demonstration} onClick={() => void practice(detail.id)}>{tr('Use this in a conversation')}</button>}
        recordControls={record => <button type="button" className="btn danger" disabled={saving || demonstration} onClick={() => void update({...snapshot.profile.choices,excluded_attempts:snapshot.profile.choices.excluded_attempts.includes(record.attempt_id) ? snapshot.profile.choices.excluded_attempts.filter(id => id !== record.attempt_id) : [...snapshot.profile.choices.excluded_attempts,record.attempt_id]})}>{snapshot.profile.choices.excluded_attempts.includes(record.attempt_id) ? tr('Excluded · restore assessment') : tr('Exclude assessment from progress')}</button>} />
    </section> : <>
      <header className="skills-page-head">
        <h1>{tr('Skills')}</h1>
        <span className="skills-page-language">{languageName ?? snapshot.target}</span>
        <button type="button" className="btn skills-page-explain" onClick={onExplain}><ToolbarIcon name="idea" size={15} />{tr('How skills work')}</button>
        <p className="skills-page-lead">{tr('Eight conversation skills. Each reply you send can earn points toward them; your level is your weakest skill.')}</p>
      </header>
      {demonstration && <p className="skills-page-demo">{tr('DEMO · SAMPLE DATA')}</p>}
      <EvidenceMappingNotice snapshot={snapshot} />
      {error && <ErrorNotice as="p" error={error}>{error}</ErrorNotice>}
      <SkillLevelsPanel key={snapshot.target} snapshot={snapshot} conversation={null} onInspect={id => inspect(id)} onPractice={demonstration ? undefined : id => void practice(id)} />
      <details className="skills-xp-breakdown">
        <summary>{tr('XP by skill: Experience and Effort')}</summary>
        <ExperienceProfile snapshot={snapshot} initialVariety={initialVariety} onInspect={inspect} />
        <ProgressRules />
      </details>
    </>}
  </main>
}
