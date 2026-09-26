import { useNavigationStore } from '../../../state/navigation/navigation'
import { SkillCatalogBrowser } from '../../../components/learning/SkillCatalogBrowser'
import { SkillGuide } from '../../../components/learning/SkillGuide'
import { useSettingsStore } from '../../../state/settings/settings'
import { ErrorNotice } from '../../../components/feedback/ErrorNotice'
import { errorMessage } from '../../../platform/diagnostics/error-details'
import { ReadingLanguageScope } from '../../../components/reading/ReadingLanguageScope'
import { TargetPhrase } from '../../../components/reading/TargetPhrase'
import { RewardsLedger } from './RewardsLedger'
import { useI18n } from '../../../components/localization/i18n'
import { InfoTip } from '../../../components/controls/InfoTip'
import { ConversationMap } from './ConversationMap'
import { SkillEvidenceContext } from '../../../state/learning/useSkillEvidence'
import { PracticeContext } from '../session/PracticeContext'
import { useEffect, useMemo, useState } from 'react'
import { getPracticeOverview } from '../../../platform/ipc/skill-evidence'
import type { PracticeOverview, SkillSnapshot } from '../../../domain/learning/evidence/skills'
import { practiceStatistics } from '../../../domain/learning/statistics/practice-statistics'
import { useSkillNavigationStore } from '../../../state/navigation/skill-navigation'
import { DetailDialog } from '../../../components/dialogs/DetailDialog'

function LanguageProgress({ snapshot, name, onClose }: { snapshot: SkillSnapshot; name: string; onClose: () => void }) {
  const tr = useI18n()
  const active = useSettingsStore(state => state.settings?.target_language === snapshot.target ? state.settings.target_variety : undefined)
  const explore = useSkillNavigationStore((state) => state.explore)
  const stats = useMemo(() => practiceStatistics(snapshot), [snapshot])
  const [domainId, setDomainId] = useState<string | null>(null)
  const [includeUnpracticed, setIncludeUnpracticed] = useState(true)
  const focus = snapshot.catalog.find(node => node.id === snapshot.profile.active_focus)
  if (!focus) throw new Error('Missing practice focus')
  const domain = domainId === null ? null : stats.domains.find(item => item.node.id === domainId)
  if (domainId !== null && !domain) throw new Error('Missing selected practice domain')
  const skills = (domain ? domain.skills : snapshot.profile.skills).filter(skill => includeUnpracticed || skill.experience + skill.effort > 0)
  return <div className="practice-statistics">
      <header className="practice-statistics-header"><h2>{name} {tr(" progress")}</h2><InfoTip>{tr("Trace every score back to the messages that contributed it.")}</InfoTip></header>
      <SkillEvidenceContext value={{ snapshot, error: null }}><PracticeContext value={{ chatId: null, selectionVersion: 0, selected: domain?.skills[0]?.skill_id ?? focus.id, select: id => { const match = stats.domains.find(item => item.skills.some(skill => skill.skill_id === id)); setDomainId(match?.node.id ?? null) } }}><ConversationMap /></PracticeContext></SkillEvidenceContext>
      <RewardsLedger snapshot={snapshot} />
      <dl className="practice-metrics">
        <div><dt>{tr("Practice XP")}</dt><dd>{snapshot.profile.xp.toLocaleString(tr.browserLocale)}</dd></div>
        <div><dt>{tr("Skills with credit")}</dt><dd>{tr.number(stats.practiced)}<small> / {snapshot.profile.skills.length}</small></dd></div>
        <div><dt>{tr("Contributing messages")}</dt><dd>{tr.number(stats.contributingMessages)}</dd></div>
      </dl>
      <InfoTip>{tr("Descriptive app records, not a validated language-proficiency score. AI assessments can be wrong; these counts are not independent trials.")}</InfoTip>
      <section aria-label={tr("Experience and effort")} className="practice-demonstrations">
        <div><strong>{tr.number(stats.experience)}</strong><span>{tr("Experience counts")}</span></div>
        <div><strong>{tr.number(stats.effort)}</strong><span>{tr("Effort counts")}</span></div>
        <InfoTip>{tr("Experience counts first use in a message; effort counts retained skills on changed retries. One message can contribute to multiple skills.")}</InfoTip>
      </section>
      <section aria-labelledby="practice-skills-title">
        <div className="practice-section-title"><h3 id="practice-skills-title">{domain ? tr(domain.node.label) : tr("All domains")} {tr(" · skill evidence")}</h3>{domainId && <button className="detail-action" onClick={() => setDomainId(null)}>{tr("All domains")}</button>}</div>
        <label className="practice-unpracticed"><input type="checkbox" checked={includeUnpracticed} onChange={event => setIncludeUnpracticed(event.target.checked)} />{tr("Include skills without credit")}</label>
        <InfoTip>{tr("Open a skill to inspect its contributing messages and assessment provenance.")}</InfoTip>
        {skills.length === 0 && <p>{tr("No recorded practice in this selection yet.")}</p>}
        <div className="practice-skill-list">{skills.map(skill => {
          const node = snapshot.catalog.find(item => item.id === skill.skill_id)
          if (!node) throw new Error(`Missing skill ${skill.skill_id}`)
          const credits = snapshot.profile.credits.filter(item => item.skill_id === skill.skill_id)
          return <details key={skill.skill_id} className="practice-skill">
            <summary><span>{tr(node.label)}{skill.star && <span className="practice-star" aria-label={tr("Skill star")}> ★</span>}</span><strong>{tr.number(skill.xp)} {tr(" XP")}</strong><small>{tr.number(skill.experience)} {tr(" experience · ")}{skill.effort} {tr(" effort")}</small></summary>
            <InfoTip>{tr("Criterion: ")}{tr(node.criterion)}</InfoTip>
            <SkillGuide snapshot={snapshot} skillId={node.id} active={active} />
            {credits.length === 0 && <p>{tr("No credited messages.")}</p>}
            {credits.map(credit => {
              const record = snapshot.records.find(item => item.attempt_id === credit.attempt_id)
              if (!record) throw new Error('Missing credited record')
              const judgment = record.assessment?.judgments.find(item => item.skill_id === skill.skill_id)
              if (!judgment) throw new Error('Missing credited assessment')
              const effort = (credit.effort ?? credit.event?.effort ?? 0) > 0
              return <article key={credit.attempt_id} className="practice-credit">
                <header><strong>{tr.number(credit.xp)} {tr(" XP · ")}{effort ? tr("Effort") : tr("Experience")}</strong><time dateTime={new Date(record.at_secs * 1000).toISOString()}>{new Date(record.at_secs * 1000).toISOString().slice(0, 16).replace('T', ' ')} {tr(" UTC")}</time></header>
                <ReadingLanguageScope language={record.target} variety={record.variety} explanation={record.native}><blockquote dir="auto"><TargetPhrase text={record.source} /></blockquote></ReadingLanguageScope><p>{judgment.rationale}</p>
                <small>{tr("Model: ")}{record.model} {tr(" · Rubric ")}{record.catalog_version} {tr(" · Prompt ")}{record.prompt_version}<br />{tr("Chat ")}{record.chat_id} {tr(" · Message ")}{record.message_id} {tr(" · Attempt ")}{record.attempt_id}</small>
              </article>
            })}
          </details>
        })}</div>
      </section>
      <details className="practice-methods"><summary>{tr("How these numbers are calculated")}</summary>
        <p>{tr("Scope: saved records for ")}{snapshot.target} {tr(" on this learner profile, across ")}{snapshot.conversation_count} {tr(" saved conversations. Deleted or edited messages and excluded evidence can change totals; this is the current projection, not an immutable history.")}</p>
        <p>{tr("XP equals experience plus effort, with 1 XP per credited skill. Correctness, assistance, difficulty and novelty do not change the award. Unchanged retries add no credit.")}</p>
        <p>{tr("A text transcript does not establish pronunciation, listening ability or retention.")}</p>
        <p>{tr("Snapshot counts cover retained source messages, not a lifetime activity log. Only completed, non-excluded records from the current catalog contribute credit. Assessments are model judgments, not independent human validation. No proficiency estimate, learning-rate claim, or statistical confidence interval is inferred here.")}</p>
        <dl className="practice-record-counts"><div><dt>{tr("Complete records")}</dt><dd>{tr.number(stats.statuses.complete)}</dd></div><div><dt>{tr("Pending")}</dt><dd>{tr.number(stats.statuses.pending)}</dd></div><div><dt>{tr("Failed")}</dt><dd>{tr.number(stats.statuses.failed)}</dd></div><div><dt>{tr("Superseded")}</dt><dd>{tr.number(stats.statuses.superseded)}</dd></div><div><dt>{tr("Stored exclusions")}</dt><dd>{tr.number(snapshot.profile.choices.excluded_attempts.length)}</dd></div></dl>
      </details>
      <p className="practice-focus">{tr("Current focus: ")}<strong>{tr(focus.label)}</strong></p>
      <button className="detail-action" onClick={() => { onClose(); explore({ target: snapshot.target, skillId: focus.id }) }}>{tr("Explore skill map")}</button>
    </div>
}

export function ProgressSummary({ snapshot, target, onClose, onLearning }: { snapshot?: SkillSnapshot; target?: string; onClose: () => void; onLearning?: (target: string) => void }) {
  const tr = useI18n()
  const included = useSettingsStore(state => state.settings?.my_languages)
  const initialTarget = target ?? snapshot?.target
  const [selected, setSelected] = useState(initialTarget)
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<{ status: 'loading' } | { status: 'ready'; overview: PracticeOverview } | { status: 'error'; error: string }>({ status: 'loading' })
  useEffect(() => {
    let disposed = false
    setLoaded(current => current.status === 'ready' ? current : { status: 'loading' })
    void getPracticeOverview().then(overview => {
      if (initialTarget && !overview.languages.some(language => language.snapshot.target === initialTarget)) throw new Error('Overview is missing the active language')
      const targets = new Set<string>()
      for (const language of overview.languages) {
        if (targets.has(language.snapshot.target)) throw new Error('Duplicate overview language')
        targets.add(language.snapshot.target)
        practiceStatistics(language.snapshot)
      }
      if (!disposed) { setLoaded({ status: 'ready', overview }); setSelected(current => overview.languages.some(language => language.snapshot.target === current) ? current : initialTarget ?? overview.languages[0]?.snapshot.target) }
    }).catch((error: unknown) => { if (!disposed) setLoaded({ status: 'error', error: errorMessage(error) }) })
    return () => { disposed = true }
  }, [snapshot, initialTarget, attempt])
  const overview = loaded.status === 'ready' ? loaded.overview : null
  const visibleLanguages = (included ?? []).flatMap(id => overview?.languages.filter(language => language.snapshot.target === id) ?? [])
  const selectedTarget = visibleLanguages.some(language => language.snapshot.target === selected) ? selected : visibleLanguages[0]?.snapshot.target
  const active = visibleLanguages.find(language => language.snapshot.target === selectedTarget)
  const snapshots = overview?.languages.map(language => language.snapshot) ?? []
  const globalXp = snapshots.reduce((total, item) => total + item.profile.xp, 0)
  const conversations = snapshots.reduce((total, item) => total + item.conversation_count, 0)
  const records = snapshots.flatMap(item => item.records)
  const practiceDates = new Set(records.map(record => new Date(record.at_secs * 1000).toISOString().slice(0, 10)))
  return <DetailDialog size="wide" title={tr("Practice progress")} onClose={onClose}>
    <div className="practice-overview">
      <header className="practice-statistics-header"><h2>{tr("App activity")}</h2>{onLearning && selectedTarget && <button onClick={() => onLearning(selectedTarget!)}>{tr("Your learning evidence")}</button>}</header>
      {loaded.status === 'loading' && <p role="status">{tr("Loading language profiles…")}</p>}
      {loaded.status === 'error' && <ErrorNotice as="div" className="turn-errors" dismissible={false} error={loaded.error}><p>{loaded.error}</p><button className="detail-action" onClick={() => setAttempt(value => value + 1)}>{tr("Retry profiles")}</button></ErrorNotice>}
      {!overview && <SkillCatalogBrowser />}
      {overview && <>
        <dl className="practice-metrics">
          <div><dt>{tr("Total practice XP")}</dt><dd>{globalXp.toLocaleString(tr.browserLocale)}</dd></div>
          <div><dt>{tr("Saved conversations")}</dt><dd>{tr.number(conversations)}</dd></div>
          <div><dt>{tr("Recorded attempts")}</dt><dd>{tr.number(records.length)}</dd></div>
          <div><dt>{tr("Practice dates (UTC)")}</dt><dd>{tr.number(practiceDates.size)}</dd></div>
        </dl>
        <InfoTip>{tr("Global XP is the sum of separate language accounts, not a combined proficiency score. Activity counts cover retained records: conversations with learner text, assessment attempts, and distinct UTC dates with attempts. Deleted records can reduce these counts.")}</InfoTip>

        <div className="practice-language-tabbar"><div className="practice-language-tabs" role="tablist" aria-label={tr("Language experience")}>{visibleLanguages.map(language => <button key={language.snapshot.target} id={`practice-tab-${language.snapshot.target}`} role="tab" aria-label={tr("{value0} {value1} XP", { value0: String(language.name), value1: language.snapshot.profile.xp })} aria-selected={selectedTarget === language.snapshot.target} aria-controls="practice-language-panel" tabIndex={selectedTarget === language.snapshot.target ? 0 : -1} onClick={() => setSelected(language.snapshot.target)} onKeyDown={event => {
          const index = visibleLanguages.findIndex(item => item.snapshot.target === selectedTarget)
          const next = event.key === 'ArrowRight' ? (index + 1) % visibleLanguages.length : event.key === 'ArrowLeft' ? (index - 1 + visibleLanguages.length) % visibleLanguages.length : event.key === 'Home' ? 0 : event.key === 'End' ? visibleLanguages.length - 1 : null
          if (next === null) return
          event.preventDefault()
          const target = visibleLanguages[next].snapshot.target
          setSelected(target)
          document.getElementById(`practice-tab-${target}`)?.focus()
        }}><span>{language.name}</span><small>{tr.number(language.snapshot.profile.xp)} {tr(" XP")}</small></button>)}</div><button type="button" className="practice-language-add" aria-label={tr('Add language…')} title={tr('Add language…')} onClick={() => useNavigationStore.getState().showOverlay('languages')}><span aria-hidden="true">+</span></button></div>
        {!active && <SkillCatalogBrowser />}
        {active && <div id="practice-language-panel" role="tabpanel" aria-labelledby={`practice-tab-${active.snapshot.target}`}>
          <LanguageProgress key={active.snapshot.target} snapshot={active.snapshot} name={active.name} onClose={onClose} />
        </div>}
      </>}
    </div>
  </DetailDialog>
}
