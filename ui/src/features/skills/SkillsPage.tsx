import { useSettingsStore } from '../../state/settings/settings'
import { ErrorNotice } from '../../components/feedback/ErrorNotice'
import { errorMessage } from '../../platform/diagnostics/error-details'
import { useI18n } from '../../components/localization/i18n'
import { EvidenceMappingNotice } from '../../components/learning/EvidenceMappingNotice'
import { SkillLevelsPanel } from '../../components/learning/SkillLevelsPanel'
import { XpOverview } from './progress/XpOverview'
import { languageCode } from '../../components/learning/LanguageTable'
import { translatedName } from '../../domain/localization'
import { EffortReport } from './progress/EffortReport'
import { useNavigationStore, type ProgressTab } from '../../state/navigation/navigation'
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
  const snapshot = isTauri ? evidence.snapshot! : skillDemo
  const language = isTauri ? languageFor(snapshot.target) : null
  return <>{(firstVisit.open || explaining) && <SkillsIntro onClose={closeIntro} />}<SkillListView onExplain={() => setExplaining(true)} initialVariety={variety} languageName={language ? translatedName(tr.locale, language.name) : snapshot.target} languageTag={language?.languageTag ?? undefined} snapshot={snapshot} demonstration={!isTauri} refresh={evidence.reload} save={evidence.save} saving={evidence.saving} onPractice={onPractice} /></>
}
/** The Progress page: the one place for the language's progress, in three
 * tabs. Skills (the default) shows skill points and levels: what each skill
 * has and needs next. XP shows every language's XP and effort, then this
 * language's XP (skill XP plus effort XP) by skill and its history. Effort
 * shows the effort counts (Understood, Fixes, Practice, Bot, Explore). Every progress counter
 * in the app opens this page on the tab that leads with its number. Opening a
 * skill replaces the tabs with that skill's page: its guide and the reviewed
 * replies for it; a request to show a skill from elsewhere opens it here. */
export function SkillListView({ initialVariety, languageName, languageTag, snapshot, demonstration, save, saving, onPractice, onExplain }: {
  onExplain: () => void; initialVariety?: string; languageName: string; languageTag?: string; snapshot: SkillSnapshot; demonstration: boolean; refresh: () => void; save: (choices: ProfileChoices) => Promise<void>; saving: boolean; onPractice: (language: string, variety: string, skillId: string) => Promise<void>
}) {
  const tr = useI18n()
  const picked = useSkillNavigationStore(state => state.selected)
  const select = useSkillNavigationStore(state => state.select)
  const mapRequest = useSkillNavigationStore(state => state.mapRequest)
  const tab = useNavigationStore(state => state.progressTab)
  const openProgress = useNavigationStore(state => state.openProgress)
  const [inspectedVariety, setInspectedVariety] = useState<string | undefined>(initialVariety)
  const [open, setOpen] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selected = picked?.target === snapshot.target ? picked.skillId : undefined
  const node = snapshot.catalog.find(n => n.kind === 'skill' && n.id === selected)
  const page = useRef<HTMLElement>(null)
  const detail = open && node ? node : null
  // A skill page and the overview are separate views: each starts at its top.
  useEffect(() => { page.current?.scrollTo?.({ top: 0 }) }, [detail?.id, tab])
  // A request to show a skill (from the conversation's panel, say) opens its page.
  useEffect(() => { if (mapRequest?.location.target === snapshot.target) setOpen(true) }, [mapRequest, snapshot.target])
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
      <button type="button" className="btn return-to-conversation skill-detail-back" onClick={() => setOpen(false)}><ToolbarIcon name="back" /><span>{tr('All {value0} skills', { value0: languageName })}</span></button>
      {error && <ErrorNotice as="p" error={error}>{error}</ErrorNotice>}
      <SkillDetailContent variety={inspectedVariety} languageName={languageName} languageTag={languageTag} node={detail} snapshot={snapshot} chatId={null} explanation={null} onSelect={inspect} guideOpen
        controls={<button className="btn primary" disabled={starting || demonstration} onClick={() => void practice(detail.id)}>{tr('Use this in a {value0} conversation', { value0: languageName })}</button>}
        recordControls={record => <button type="button" className="btn danger" disabled={saving || demonstration} onClick={() => void update({...snapshot.profile.choices,excluded_attempts:snapshot.profile.choices.excluded_attempts.includes(record.attempt_id) ? snapshot.profile.choices.excluded_attempts.filter(id => id !== record.attempt_id) : [...snapshot.profile.choices.excluded_attempts,record.attempt_id]})}>{snapshot.profile.choices.excluded_attempts.includes(record.attempt_id) ? tr('Excluded · restore assessment') : tr('Exclude assessment from progress')}</button>} />
    </section> : <>
      <header className="skills-page-head">
        <h1><span className="language-code" aria-hidden="true">{languageCode({ languageTag: languageTag ?? null, target: snapshot.target })}</span>{tr('{value0} progress', { value0: languageName })}</h1>
        {tab === 'skills' && <button type="button" className="btn skills-page-explain" onClick={onExplain}><ToolbarIcon name="idea" size={15} />{tr('How skills work')}</button>}
      </header>
      <ProgressTabs tab={tab} onTab={openProgress} />
      {demonstration && <p className="skills-page-demo">{tr('DEMO · SAMPLE DATA')}</p>}
      {error && <ErrorNotice as="p" error={error}>{error}</ErrorNotice>}
      <div className="progress-tab-panel" role="tabpanel" id={`progress-panel-${tab}`} aria-labelledby={`progress-tab-${tab}`} key={tab}>
        {tab === 'skills' && <>
          <p className="progress-tab-lead">{tr('Eight conversation skills. Each reply you send can earn points toward them; your level is your weakest skill.')}</p>
          <EvidenceMappingNotice snapshot={snapshot} />
          <SkillLevelsPanel key={snapshot.target} snapshot={snapshot} languageName={languageName} conversation={null} onInspect={id => inspect(id)} onPractice={demonstration ? undefined : id => void practice(id)} />
        </>}
        {tab === 'xp' && <XpOverview snapshot={snapshot} languageName={languageName} onInspect={id => inspect(id)} />}
        {tab === 'effort' && <EffortReport key={snapshot.target} target={snapshot.target} languageName={languageName} revision={snapshot} />}
      </div>
    </>}
  </main>
}

const PROGRESS_TABS: { tab: ProgressTab; label: string }[] = [
  { tab: 'skills', label: 'Skills' },
  { tab: 'xp', label: 'XP' },
  { tab: 'effort', label: 'Effort' },
]

/** Skills · XP · Effort. Arrow keys move between tabs, as in any tab list. */
function ProgressTabs({ tab, onTab }: { tab: ProgressTab; onTab: (tab: ProgressTab) => void }) {
  const tr = useI18n()
  return <div className="progress-tabs" role="tablist" aria-label={tr('Progress')}>
    {PROGRESS_TABS.map(item => <button key={item.tab} type="button" role="tab" id={`progress-tab-${item.tab}`} aria-selected={tab === item.tab}
      aria-controls={`progress-panel-${item.tab}`} tabIndex={tab === item.tab ? 0 : -1} onClick={() => onTab(item.tab)} onKeyDown={event => {
        const index = PROGRESS_TABS.findIndex(entry => entry.tab === tab)
        const next = event.key === 'ArrowRight' ? (index + 1) % PROGRESS_TABS.length : event.key === 'ArrowLeft' ? (index + PROGRESS_TABS.length - 1) % PROGRESS_TABS.length : null
        if (next === null) return
        event.preventDefault()
        onTab(PROGRESS_TABS[next].tab)
        document.getElementById(`progress-tab-${PROGRESS_TABS[next].tab}`)?.focus()
      }}>{tr(item.label)}</button>)}
  </div>
}
