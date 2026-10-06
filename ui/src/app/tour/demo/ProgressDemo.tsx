import { useI18n } from '../../../components/localization/i18n'
import { SkillLevelsPanel } from '../../../components/learning/SkillLevelsPanel'
import { PROGRESS_SNAPSHOT } from './fixtures'

/// The Progress page's Skills tab, filled with a fixed snapshot.
export function ProgressDemo() {
  const tr = useI18n()
  return <div className="demo-page">
    <main className="skills-page">
      <header className="skills-page-head"><h1>{tr('Progress')}</h1></header>
      <SkillLevelsPanel languageName={tr('Spanish')} snapshot={PROGRESS_SNAPSHOT} conversation={null} onInspect={null} />
    </main>
  </div>
}
