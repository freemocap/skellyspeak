import { DomainEvidenceTree } from '../../../components/learning/DomainEvidenceTree'
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
  const explore = useSkillNavigationStore((state) => state.explore)
  const stats = useMemo(() => practiceStatistics(snapshot), [snapshot])
  const [domainId, setDomainId] = useState<string | null>(null)
  const [includeUnpracticed, setIncludeUnpracticed] = useState(false)
  const focus = snapshot.catalog.find(node => node.id === snapshot.profile.active_focus)
  if (!focus) throw new Error('Missing practice focus')
  const domain = domainId === null ? null : stats.domains.find(item => item.node.id === domainId)
  if (domainId !== null && !domain) throw new Error('Missing selected practice domain')
  const skills = (domain ? domain.skills : snapshot.profile.skills).filter(skill => includeUnpracticed || skill.successes + skill.assisted > 0)
  return <div className="practice-statistics">
      <header className="practice-statistics-header"><h2>{name} {tr(" progress")}</h2><InfoTip>{tr("Trace every score back to the messages that contributed it.")}</InfoTip></header>
      <SkillEvidenceContext value={{ snapshot, error: null }}><PracticeContext value={{ chatId: null, selectionVersion: 0, selected: domain?.skills[0]?.skill_id ?? focus.id, select: id => { const match = stats.domains.find(item => item.skills.some(skill => skill.skill_id === id)); setDomainId(match?.node.id ?? null) } }}><ConversationMap /></PracticeContext></SkillEvidenceContext>
      <DomainEvidenceTree snapshot={snapshot} onSelect={setDomainId} />
      <RewardsLedger snapshot={snapshot} />
      <dl className="practice-metrics">
        <div><dt>{tr("Practice XP")}</dt><dd>{snapshot.profile.xp.toLocaleString(tr.browserLocale)}</dd></div>
        <div><dt>{tr("Lesson quiz XP")}</dt><dd>{stats.quizXp}</dd></div>
        <div><dt>{tr("Skills with credit")}</dt><dd>{stats.practiced}<small> / {snapshot.profile.skills.length}</small></dd></div>
        <div><dt>{tr("Skill stars")}</dt><dd>{stats.stars}<small> / {snapshot.profile.skills.length}</small></dd></div>
        <div><dt>{tr("Contributing messages")}</dt><dd>{stats.contributingMessages}</dd></div>
      </dl>
      <InfoTip>{tr("Descriptive app records, not a validated language-proficiency score. AI assessments can be wrong; these counts are not independent trials.")}</InfoTip>
      <section aria-label={tr("Credited demonstrations")} className="practice-demonstrations">
        <div><strong>{stats.unassisted}</strong><span>{tr("Unassisted skill demonstrations")}</span></div>
        <div><strong>{stats.assisted}</strong><span>{tr("Assisted skill demonstrations")}</span></div>
        <InfoTip>{tr("Counts are distinct wording–skill pairs, not messages. One message can contribute to multiple skills.")}</InfoTip>
      </section>
      <section aria-labelledby="practice-skills-title">
        <div className="practice-section-title"><h3 id="practice-skills-title">{domain ? domain.node.label : tr("All domains")} {tr(" · skill evidence")}</h3>{domainId && <button className="lesson-action" onClick={() => setDomainId(null)}>{tr("All domains")}</button>}</div>
        <label className="practice-unpracticed"><input type="checkbox" checked={includeUnpracticed} onChange={event => setIncludeUnpracticed(event.target.checked)} />{tr("Include skills without credit")}</label>
        <InfoTip>{tr("Open a skill to inspect its contributing messages and assessment provenance.")}</InfoTip>
        {skills.length === 0 && <p>{tr("No credited demonstrations in this selection yet. Your first credited message will appear here.")}</p>}
        <div className="practice-skill-list">{skills.map(skill => {
          const node = snapshot.catalog.find(item => item.id === skill.skill_id)
          if (!node) throw new Error(`Missing skill ${skill.skill_id}`)
          const credits = snapshot.profile.credits.filter(item => item.skill_id === skill.skill_id)
          return <details key={skill.skill_id} className="practice-skill">
            <summary><span>{node.label}{skill.star && <span className="practice-star" aria-label={tr("Skill star")}> ★</span>}</span><strong>{skill.xp} {tr(" XP")}</strong><small>{skill.successes} {tr(" unassisted · ")}{skill.assisted} {tr(" assisted")}</small></summary>
            <InfoTip>{tr("Criterion: ")}{node.criterion}</InfoTip>
            {credits.length === 0 && <p>{tr("No credited messages.")}</p>}
            {credits.map(credit => {
              const record = snapshot.records.find(item => item.attempt_id === credit.attempt_id)
              if (!record) throw new Error('Missing credited record')
              const judgment = record.assessment?.judgments.find(item => item.skill_id === skill.skill_id)
              if (!judgment) throw new Error('Missing credited assessment')
              const assisted = record.input.suggestion || record.input.scaffold || record.input.revision
              return <article key={credit.attempt_id} className="practice-credit">
                <header><strong>{credit.xp} {tr(" XP · ")}{assisted ? tr("Assisted") : tr("Unassisted")}</strong><time dateTime={new Date(record.at_secs * 1000).toISOString()}>{new Date(record.at_secs * 1000).toISOString().slice(0, 16).replace('T', ' ')} {tr(" UTC")}</time></header>
                <blockquote dir="auto">{record.source}</blockquote><p>{judgment.rationale}</p>
                <small>{tr("Model: ")}{record.model} {tr(" · Rubric ")}{record.catalog_version} {tr(" · Prompt ")}{record.prompt_version}<br />{tr("Chat ")}{record.chat_id} {tr(" · Message ")}{record.message_id} {tr(" · Attempt ")}{record.attempt_id}</small>
              </article>
            })}
          </details>
        })}</div>
      </section>
      <details className="practice-methods"><summary>{tr("How these numbers are calculated")}</summary>
        <p>{tr("Scope: saved records for ")}{snapshot.target} {tr(" on this learner profile, across ")}{snapshot.conversation_count} {tr(" saved conversations. Deleted or edited messages and excluded evidence can change totals; this is the current projection, not an immutable history.")}</p>
        <p>{tr("Rules version ")}{snapshot.profile.rules_version}{tr("; catalog version ")}{snapshot.catalog_version}. {snapshot.profile.rules_version >= 2 ? tr("XP comes from persisted evidence awards using the support, difficulty and novelty policy captured for each attempt. Repeated wording cannot earn duplicate credit for the same construct.") : tr("Legacy rules award 10 XP per distinct unassisted wording–skill demonstration and 2 XP per assisted one. Repeated wording is normalized for whitespace and letter case; unassisted evidence takes precedence.")} {tr(" Three distinct unassisted demonstrations earn an app star; that is a practice milestone, not proof of mastery.")}</p>
        <p>{tr("“Assisted” means a suggestion, scaffold, or revision was recorded by the app. Assistance outside the app is not observed. Speech inputs are transcripts, not acoustic pronunciation assessments.")}</p>
        <p>{tr("Snapshot counts cover retained source messages, not a lifetime activity log. Only completed, non-excluded records from the current catalog contribute credit. Assessments are model judgments, not independent human validation. No proficiency estimate, learning-rate claim, or statistical confidence interval is inferred here.")}</p>
        <dl className="practice-record-counts"><div><dt>{tr("Complete records")}</dt><dd>{stats.statuses.complete}</dd></div><div><dt>{tr("Pending")}</dt><dd>{stats.statuses.pending}</dd></div><div><dt>{tr("Failed")}</dt><dd>{stats.statuses.failed}</dd></div><div><dt>{tr("Superseded")}</dt><dd>{stats.statuses.superseded}</dd></div><div><dt>{tr("Stored exclusions")}</dt><dd>{snapshot.profile.choices.excluded_attempts.length}</dd></div></dl>
      </details>
      <p className="practice-focus">{tr("Current focus: ")}<strong>{focus.label}</strong></p>
      <button className="lesson-action" onClick={() => { onClose(); explore({ target: snapshot.target, skillId: focus.id }) }}>{tr("Explore skill map")}</button>
    </div>
}

export function ProgressSummary({ snapshot, onClose, onLearning }: { snapshot: SkillSnapshot; onClose: () => void; onLearning?: (target: string) => void }) {
  const tr = useI18n()
  const [selected, setSelected] = useState(snapshot.target)
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<{ status: 'loading' } | { status: 'ready'; overview: PracticeOverview } | { status: 'error'; error: string }>({ status: 'loading' })
  useEffect(() => {
    let disposed = false
    setLoaded({ status: 'loading' })
    void getPracticeOverview().then(overview => {
      if (!overview.languages.some(language => language.snapshot.target === snapshot.target)) throw new Error('Overview is missing the active language')
      const targets = new Set<string>()
      for (const language of overview.languages) {
        if (targets.has(language.snapshot.target)) throw new Error('Duplicate overview language')
        targets.add(language.snapshot.target)
        practiceStatistics(language.snapshot)
      }
      if (!disposed) setLoaded({ status: 'ready', overview })
    }).catch((error: unknown) => { if (!disposed) setLoaded({ status: 'error', error: String(error) }) })
    return () => { disposed = true }
  }, [snapshot, attempt])
  const overview = loaded.status === 'ready' ? loaded.overview : null
  const active = overview?.languages.find(language => language.snapshot.target === selected)
  const snapshots = overview?.languages.map(language => language.snapshot) ?? []
  const globalXp = snapshots.reduce((total, item) => total + item.profile.xp, 0)
  const conversations = snapshots.reduce((total, item) => total + item.conversation_count, 0)
  const records = snapshots.flatMap(item => item.records)
  const practiceDates = new Set(records.map(record => new Date(record.at_secs * 1000).toISOString().slice(0, 10)))
  return <DetailDialog title={tr("Practice progress")} onClose={onClose}>
    <div className="practice-overview">
      <header className="practice-statistics-header"><h2>{tr("App activity")}</h2>{onLearning && <button onClick={() => onLearning(selected)}>{tr("Your learning evidence")}</button>}</header>
      {loaded.status === 'loading' && <p role="status">{tr("Loading language profiles…")}</p>}
      {loaded.status === 'error' && <div role="alert"><p>{loaded.error}</p><button className="lesson-action" onClick={() => setAttempt(value => value + 1)}>{tr("Retry profiles")}</button></div>}
      {overview && <>
        <dl className="practice-metrics">
          <div><dt>{tr("Total practice XP")}</dt><dd>{globalXp.toLocaleString(tr.browserLocale)}</dd></div>
          <div><dt>{tr("Saved conversations")}</dt><dd>{conversations}</dd></div>
          <div><dt>{tr("Recorded attempts")}</dt><dd>{records.length}</dd></div>
          <div><dt>{tr("Practice dates (UTC)")}</dt><dd>{practiceDates.size}</dd></div>
        </dl>
        <InfoTip>{tr("Global XP is the sum of separate language accounts, not a combined proficiency score. Activity counts cover retained records: conversations with learner text, assessment attempts, and distinct UTC dates with attempts. Deleted records can reduce these counts.")}</InfoTip>

        <div className="practice-language-tabs" role="tablist" aria-label={tr("Language experience")}>{overview.languages.map(language => <button key={language.snapshot.target} id={`practice-tab-${language.snapshot.target}`} role="tab" aria-label={tr("{value0} {value1} XP", { value0: String(language.name), value1: String(language.snapshot.profile.xp) })} aria-selected={selected === language.snapshot.target} aria-controls="practice-language-panel" tabIndex={selected === language.snapshot.target ? 0 : -1} onClick={() => setSelected(language.snapshot.target)} onKeyDown={event => {
          const index = overview.languages.findIndex(item => item.snapshot.target === selected)
          const next = event.key === 'ArrowRight' ? (index + 1) % overview.languages.length : event.key === 'ArrowLeft' ? (index - 1 + overview.languages.length) % overview.languages.length : event.key === 'Home' ? 0 : event.key === 'End' ? overview.languages.length - 1 : null
          if (next === null) return
          event.preventDefault()
          const target = overview.languages[next].snapshot.target
          setSelected(target)
          document.getElementById(`practice-tab-${target}`)?.focus()
        }}><span>{language.name}</span><small>{language.snapshot.profile.xp} {tr(" XP")}</small></button>)}</div>
        {active && <div id="practice-language-panel" role="tabpanel" aria-labelledby={`practice-tab-${active.snapshot.target}`}>
          {active.snapshot.records.length === 0 && active.snapshot.conversation_count === 0 ? <div className="practice-language-empty"><h2>{active.name} {tr(" experience")}</h2><p>{tr("We don’t have any experience for this language yet.")}</p><p>{tr("0 XP · No recorded practice. Activity in another language does not add experience here.")}</p></div> : <LanguageProgress key={active.snapshot.target} snapshot={active.snapshot} name={active.name} onClose={onClose} />}
        </div>}
      </>}
    </div>
  </DetailDialog>
}
