import { useState } from 'react'
import { ErrorNotice } from '../../../components/feedback/ErrorNotice'
import { InfoTip } from '../../../components/controls/InfoTip'
import { LanguageTable } from '../../../components/learning/LanguageTable'
import { useI18n } from '../../../components/localization/i18n'
import { skillColors } from '../../../domain/learning/catalog/skill-domains'
import type { SkillSnapshot } from '../../../domain/learning/evidence/skills'
import { experienceProfile } from '../../../domain/learning/statistics/experience-profile'
import { practiceStatistics } from '../../../domain/learning/statistics/practice-statistics'
import { useVisibleEffort } from '../../../state/learning/EffortProgressContext'
import { useLanguageTotals } from '../../../state/learning/useLanguageTotals'
import { useSettingsStore } from '../../../state/settings/settings'
import { openLanguageProgress } from '../../../state/navigation/language-progress'
import { LearnerModel } from '../learner/LearnerModel'
import { ProgressRules } from '../learner/ProgressRules'
import { XpHistory } from './XpHistory'

/** The Progress page's XP tab, from the widest view in: every language's XP,
 * then this language's XP as skill XP plus effort XP, split by skill beside
 * the history of saved awards, then how XP is counted and the evidence behind
 * it. Skill points and levels are on the Skills tab; effort counts on Effort. */
export function XpOverview({ snapshot, languageName, onInspect }: {
  snapshot: SkillSnapshot; languageName: string; onInspect: (id: string) => void
}) {
  const tr = useI18n()
  const effort = useVisibleEffort()
  const included = useSettingsStore(state => state.settings?.my_languages)
  const totals = useLanguageTotals(snapshot, effort.value, included)
  const stats = practiceStatistics(snapshot)
  const profile = experienceProfile(snapshot, null)
  const most = Math.max(1, ...profile.skills.map(skill => skill.xp))
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  return <div className="progress-xp">
    <section className="progress-section" aria-labelledby="progress-xp-languages">
      <h2 id="progress-xp-languages">{tr('All languages')}<InfoTip>{tr('Each language keeps its own XP and effort; the globe total is the sum of their XP.')}</InfoTip></h2>
      {totals.error && <ErrorNotice error={totals.error}>{totals.error}</ErrorNotice>}
      {totals.rows ? <LanguageTable rows={totals.rows} active={snapshot.target} compact={false} onSelect={target => void openLanguageProgress(target, 'xp')} /> : !totals.error && <p role="status">{tr('Loading…')}</p>}
    </section>

    <section className="progress-section" aria-labelledby="progress-xp-language">
      <h2 id="progress-xp-language">{tr('{value0} XP', { value0: languageName })}<InfoTip>{tr('XP is skill XP plus effort XP. Effort counts on the Effort tab (Understood, Fixes and the rest) are counted apart from this number.')}</InfoTip></h2>
      <dl className="progress-xp-equation">
        <div data-total="xp"><dt>{tr('XP')}</dt><dd>{tr.number(snapshot.profile.xp)}</dd></div>
        <span className="progress-xp-operator" aria-hidden="true">=</span>
        <div data-kind="experience"><dt>{tr('Skill XP')}<InfoTip>{tr('1 XP for each skill a message uses for the first time.')}</InfoTip></dt><dd>{tr.number(stats.experience)}</dd></div>
        <span className="progress-xp-operator" aria-hidden="true">+</span>
        <div data-kind="effort"><dt>{tr('Effort XP')}<InfoTip>{tr('1 XP for each skill a changed retry keeps.')}</InfoTip></dt><dd>{tr.number(stats.effort)}</dd></div>
      </dl>
      <p className="progress-section-note">{tr('From {value0} of your messages.', { value0: tr.number(stats.contributingMessages) })}</p>
      <div className="progress-xp-columns">
        <section className="progress-section" aria-labelledby="progress-xp-skills">
          <h3 id="progress-xp-skills">{tr('By skill')}</h3>
          <ol className="progress-xp-skills">{profile.skills.map(skill => {
            const colours = skillColors(skill.id)
            return <li key={skill.id}>
              <button type="button" className="progress-xp-skill" style={{ color: colours.mark }} onClick={() => onInspect(skill.id)}
                aria-label={tr('{value0}: {value1} XP, {value2} skill XP and {value3} effort XP', { value0: tr(skill.label), value1: skill.xp, value2: skill.experience, value3: skill.effort })}>
                <span className="progress-xp-skill-name" style={{ color: colours.ink }}>{tr(skill.label)}</span>
                <span className="progress-xp-skill-bar" aria-hidden="true">
                  <span data-kind="experience" style={{ inlineSize: `${skill.experience / most * 100}%` }} />
                  <span data-kind="effort" style={{ inlineSize: `${skill.effort / most * 100}%` }} />
                </span>
                <strong aria-hidden="true">{tr.number(skill.xp)}</strong>
              </button>
            </li>
          })}</ol>
        </section>
        <XpHistory snapshot={snapshot} />
      </div>
    </section>

    <footer className="progress-xp-foot">
      <ProgressRules />
      <div className="progress-xp-evidence">
        <button type="button" className="btn" onClick={() => setEvidenceOpen(true)}>{tr('Your learning evidence')}</button>
        <InfoTip>{tr('Every assessment behind these numbers, by partner, with YAML export.')}</InfoTip>
      </div>
    </footer>
    {evidenceOpen && <LearnerModel target={snapshot.target} languageName={languageName} onClose={() => setEvidenceOpen(false)} />}
  </div>
}
