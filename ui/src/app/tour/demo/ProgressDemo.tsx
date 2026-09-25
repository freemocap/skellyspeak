import { useState } from 'react'
import { useI18n } from '../../../components/localization/i18n'
import { ConversationMap } from '../../../features/conversation/progress/ConversationMap'
import { SkillEvidenceContext } from '../../../state/learning/useSkillEvidence'
import { PracticeContext } from '../../../features/conversation/session/PracticeContext'
import { PROGRESS_LANGUAGES, PROGRESS_SNAPSHOT } from './fixtures'

const noop = () => {}
const firstSkillId = PROGRESS_SNAPSHOT.profile.skills[0]!.skill_id

/// The Progress dialog's own shape: totals, one tab per language and the real
/// skill list (its own Category filter), filled with a fixed snapshot.
export function ProgressDemo() {
  const tr = useI18n()
  const [selected, setSelected] = useState(PROGRESS_LANGUAGES[0].name)
  const active = PROGRESS_LANGUAGES.find(language => language.name === selected)!
  return <div className="demo-page">
    <div className="practice-overview">
      <header className="practice-statistics-header"><h2>{tr('App activity')}</h2></header>
      <dl className="practice-metrics">
        <div><dt>{tr('Total practice XP')}</dt><dd>{PROGRESS_SNAPSHOT.profile.xp}</dd></div>
        <div><dt>{tr('Saved conversations')}</dt><dd>{PROGRESS_SNAPSHOT.conversation_count}</dd></div>
        <div><dt>{tr('Recorded attempts')}</dt><dd>{PROGRESS_SNAPSHOT.records.length}</dd></div>
        <div><dt>{tr('Practice dates (UTC)')}</dt><dd>1</dd></div>
      </dl>
      <div className="practice-language-tabs" role="tablist" aria-label={tr('Language experience')}>
        {PROGRESS_LANGUAGES.map(language => <button key={language.name} type="button" role="tab" aria-selected={selected === language.name}
          onClick={() => setSelected(language.name)}><span>{language.name}</span><small>{language.snapshot.profile.xp} {tr(' XP')}</small></button>)}
      </div>
      <div role="tabpanel">
        <SkillEvidenceContext value={{ snapshot: active.snapshot, error: null }}>
          <PracticeContext value={{ chatId: null, selectionVersion: 0, selected: firstSkillId, select: noop }}>
            <ConversationMap />
          </PracticeContext>
        </SkillEvidenceContext>
      </div>
    </div>
  </div>
}
