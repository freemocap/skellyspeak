import { InfoTip } from '../../ui/InfoTip'
import { ConversationMap } from './ConversationMap'
import { SkillEvidenceContext } from '../../state/useSkillEvidence'
import { PracticeContext } from './PracticeContext'
import { useEffect, useMemo, useState } from 'react'
import { getPracticeOverview } from '../../platform/skill-evidence'
import type { PracticeOverview, SkillSnapshot } from '../../domain/skills/skills'
import { practiceStatistics } from '../../domain/skills/practice-statistics'
import { useSkillNavigationStore } from '../../state/skill-navigation'
import { DetailDialog } from '../../ui/DetailDialog'

function LanguageProgress({ snapshot, name, onClose }: { snapshot: SkillSnapshot; name: string; onClose: () => void }) {
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
      <header className="practice-statistics-header"><h2>{name} progress</h2><InfoTip>Trace every score back to the messages that contributed it.</InfoTip></header>
      <SkillEvidenceContext value={{ snapshot, error: null }}><PracticeContext value={{ chatId: null, selectionVersion: 0, selected: domain?.skills[0]?.skill_id ?? focus.id, select: id => { const match = stats.domains.find(item => item.skills.some(skill => skill.skill_id === id)); setDomainId(match?.node.id ?? null) } }}><ConversationMap /></PracticeContext></SkillEvidenceContext>
      <dl className="practice-metrics">
        <div><dt>Practice XP</dt><dd>{snapshot.profile.xp.toLocaleString()}</dd></div>
        <div><dt>Skills with credit</dt><dd>{stats.practiced}<small> / {snapshot.profile.skills.length}</small></dd></div>
        <div><dt>Skill stars</dt><dd>{stats.stars}<small> / {snapshot.profile.skills.length}</small></dd></div>
        <div><dt>Contributing messages</dt><dd>{stats.contributingMessages}</dd></div>
      </dl>
      <InfoTip>Descriptive app records, not a validated language-proficiency score. AI assessments can be wrong; these counts are not independent trials.</InfoTip>
      <section aria-label="Credited demonstrations" className="practice-demonstrations">
        <div><strong>{stats.unassisted}</strong><span>Unassisted skill demonstrations</span></div>
        <div><strong>{stats.assisted}</strong><span>Assisted skill demonstrations</span></div>
        <InfoTip>Counts are distinct wording–skill pairs, not messages. One message can contribute to multiple skills.</InfoTip>
      </section>
      <section aria-labelledby="practice-skills-title">
        <div className="practice-section-title"><h3 id="practice-skills-title">{domain ? domain.node.label : 'All domains'} · skill evidence</h3>{domainId && <button className="lesson-action" onClick={() => setDomainId(null)}>All domains</button>}</div>
        <label className="practice-unpracticed"><input type="checkbox" checked={includeUnpracticed} onChange={event => setIncludeUnpracticed(event.target.checked)} />Include skills without credit</label>
        <InfoTip>Open a skill to inspect its contributing messages and assessment provenance.</InfoTip>
        {skills.length === 0 && <p>No credited demonstrations in this selection yet. Your first credited message will appear here.</p>}
        <div className="practice-skill-list">{skills.map(skill => {
          const node = snapshot.catalog.find(item => item.id === skill.skill_id)
          if (!node) throw new Error(`Missing skill ${skill.skill_id}`)
          const credits = snapshot.profile.credits.filter(item => item.skill_id === skill.skill_id)
          return <details key={skill.skill_id} className="practice-skill">
            <summary><span>{node.label}{skill.star && <span className="practice-star" aria-label="Skill star"> ★</span>}</span><strong>{skill.xp} XP</strong><small>{skill.successes} unassisted · {skill.assisted} assisted</small></summary>
            <InfoTip>Criterion: {node.criterion}</InfoTip>
            {credits.length === 0 && <p>No credited messages.</p>}
            {credits.map(credit => {
              const record = snapshot.records.find(item => item.attempt_id === credit.attempt_id)
              if (!record) throw new Error('Missing credited record')
              const judgment = record.assessment?.judgments.find(item => item.skill_id === skill.skill_id)
              if (!judgment) throw new Error('Missing credited assessment')
              const assisted = record.input.suggestion || record.input.scaffold || record.input.revision
              return <article key={credit.attempt_id} className="practice-credit">
                <header><strong>{credit.xp} XP · {assisted ? 'Assisted' : 'Unassisted'}</strong><time dateTime={new Date(record.at_secs * 1000).toISOString()}>{new Date(record.at_secs * 1000).toISOString().slice(0, 16).replace('T', ' ')} UTC</time></header>
                <blockquote dir="auto">{record.source}</blockquote><p>{judgment.rationale}</p>
                <small>Model: {record.model} · Rubric {record.catalog_version} · Prompt {record.prompt_version}<br />Chat {record.chat_id} · Message {record.message_id} · Attempt {record.attempt_id}</small>
              </article>
            })}
          </details>
        })}</div>
      </section>
      <details className="practice-methods"><summary>How these numbers are calculated</summary>
        <p>Scope: saved records for {snapshot.target} on this learner profile, across {snapshot.conversation_count} saved conversations. Deleted or edited messages and excluded evidence can change totals; this is the current projection, not an immutable history.</p>
        <p>Rules version {snapshot.profile.rules_version}; catalog version {snapshot.catalog_version}. Current rules award 10 XP per distinct unassisted wording–skill demonstration and 2 XP per assisted one. Repeated wording is normalized for whitespace and letter case. Unassisted evidence takes precedence over assisted evidence for the same wording and skill. Three distinct unassisted demonstrations earn an app star; that is a practice milestone, not proof of mastery.</p>
        <p>“Assisted” means a suggestion, scaffold, or revision was recorded by the app. Assistance outside the app is not observed. Speech inputs are transcripts, not acoustic pronunciation assessments.</p>
        <p>Snapshot counts cover retained source messages, not a lifetime activity log. Only completed, non-excluded records from the current catalog contribute credit. Assessments are model judgments, not independent human validation. No proficiency estimate, learning-rate claim, or statistical confidence interval is inferred here.</p>
        <dl className="practice-record-counts"><div><dt>Complete records</dt><dd>{stats.statuses.complete}</dd></div><div><dt>Pending</dt><dd>{stats.statuses.pending}</dd></div><div><dt>Failed</dt><dd>{stats.statuses.failed}</dd></div><div><dt>Superseded</dt><dd>{stats.statuses.superseded}</dd></div><div><dt>Stored exclusions</dt><dd>{snapshot.profile.choices.excluded_attempts.length}</dd></div></dl>
      </details>
      <p className="practice-focus">Current focus: <strong>{focus.label}</strong></p>
      <button className="lesson-action" onClick={() => { onClose(); explore({ target: snapshot.target, skillId: focus.id }) }}>Explore skill map</button>
    </div>
}

export function ProgressSummary({ snapshot, onClose }: { snapshot: SkillSnapshot; onClose: () => void }) {
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
  return <DetailDialog title="Practice progress" onClose={onClose}>
    <div className="practice-overview">
      <header className="practice-statistics-header"><h2>App activity</h2></header>
      {loaded.status === 'loading' && <p role="status">Loading language profiles…</p>}
      {loaded.status === 'error' && <div role="alert"><p>{loaded.error}</p><button className="lesson-action" onClick={() => setAttempt(value => value + 1)}>Retry profiles</button></div>}
      {overview && <>
        <dl className="practice-metrics">
          <div><dt>Total practice XP</dt><dd>{globalXp.toLocaleString()}</dd></div>
          <div><dt>Saved conversations</dt><dd>{conversations}</dd></div>
          <div><dt>Recorded attempts</dt><dd>{records.length}</dd></div>
          <div><dt>Practice dates (UTC)</dt><dd>{practiceDates.size}</dd></div>
        </dl>
        <InfoTip>Global XP is the sum of separate language accounts, not a combined proficiency score. Activity counts cover retained records: conversations with learner text, assessment attempts, and distinct UTC dates with attempts. Deleted records can reduce these counts.</InfoTip>

        <div className="practice-language-tabs" role="tablist" aria-label="Language experience">{overview.languages.map(language => <button key={language.snapshot.target} id={`practice-tab-${language.snapshot.target}`} role="tab" aria-label={`${language.name} ${language.snapshot.profile.xp} XP`} aria-selected={selected === language.snapshot.target} aria-controls="practice-language-panel" tabIndex={selected === language.snapshot.target ? 0 : -1} onClick={() => setSelected(language.snapshot.target)} onKeyDown={event => {
          const index = overview.languages.findIndex(item => item.snapshot.target === selected)
          const next = event.key === 'ArrowRight' ? (index + 1) % overview.languages.length : event.key === 'ArrowLeft' ? (index - 1 + overview.languages.length) % overview.languages.length : event.key === 'Home' ? 0 : event.key === 'End' ? overview.languages.length - 1 : null
          if (next === null) return
          event.preventDefault()
          const target = overview.languages[next].snapshot.target
          setSelected(target)
          document.getElementById(`practice-tab-${target}`)?.focus()
        }}><span>{language.name}</span><small>{language.snapshot.profile.xp} XP</small></button>)}</div>
        {active && <div id="practice-language-panel" role="tabpanel" aria-labelledby={`practice-tab-${active.snapshot.target}`}>
          {active.snapshot.records.length === 0 && active.snapshot.conversation_count === 0 ? <div className="practice-language-empty"><h2>{active.name} experience</h2><p>We don’t have any experience for this language yet.</p><p>0 XP · No recorded practice. Activity in another language does not add experience here.</p></div> : <LanguageProgress key={active.snapshot.target} snapshot={active.snapshot} name={active.name} onClose={onClose} />}
        </div>}
      </>}
    </div>
  </DetailDialog>
}
