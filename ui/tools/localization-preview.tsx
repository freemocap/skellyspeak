import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nProvider, useI18n } from '../src/components/localization/i18n'
import { UI_LOCALE_METADATA } from '../src/domain/localization'
import { SkillList } from '../src/components/learning/SkillList'
import { SkillOverview } from '../src/features/skills/overview/SkillOverview'
import { RewardBadge } from '../src/features/conversation/progress/RewardBadge'
import { Markdown } from '../src/components/reading/Markdown'
import { skillDemo } from '../src/domain/learning/catalog/skillDemo'
import '../src/styles/index.css'

const snapshot = structuredClone(skillDemo)
snapshot.profile.skills.find(item => item.skill_id === 'referent')!.xp = 1234
function Samples() {
  const tr = useI18n()
  const [selected, select] = useState('referent')
  const node = snapshot.catalog.find(item => item.id === selected)!
  return <main className="skills-page" style={{ maxWidth: 920, margin: 'auto', padding: 24, height: 'auto', overflow: 'visible' }}>
    <h1>{tr('Skills')}</h1>
    <SkillOverview node={node} snapshot={snapshot} />
    <RewardBadge domainId="reference" label="Identify a referent" xp={1234} quote="Ese café está cerca de aquí." creditKind="stored" />
    <Markdown text={'[[Ese café]]'} onTerm={() => {}} />
    <SkillList snapshot={snapshot} selected={selected} onSelect={select} />
  </main>
}
function Preview() {
  const [locale, setLocale] = useState('german')
  useEffect(() => {
    document.documentElement.lang = UI_LOCALE_METADATA[locale].tag
    document.documentElement.dir = UI_LOCALE_METADATA[locale].direction
  }, [locale])
  return <><header dir="ltr" style={{ padding: 16, borderBottom: '1px solid var(--line)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
    <strong>Localization review · sample data</strong>
    <label>Interface language <select value={locale} onChange={event => setLocale(event.target.value)}>{Object.entries(UI_LOCALE_METADATA).map(([id, value]) => <option key={id} value={id}>{value.endonym}</option>)}</select></label>
  </header><I18nProvider locale={locale}><Samples /></I18nProvider></>
}
createRoot(document.getElementById('root')!).render(<Preview />)
