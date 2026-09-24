/** Production components; synthetic observations, no provider calls or workspace writes. */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { mockIPC } from '@tauri-apps/api/mocks'
import { I18nProvider } from '../src/components/localization/i18n'
import { skillDemo } from '../src/domain/learning/catalog/skillDemo'
import { type SkillRecord } from '../src/domain/learning/evidence/skills'
import { SkillListView } from '../src/features/skills/SkillsPage'
import { ProgressSummary } from '../src/features/conversation/progress/ProgressSummary'
import '../src/styles/index.css'

const snapshot = structuredClone(skillDemo)
snapshot.target = 'spanish'
snapshot.profile.choices.target = 'spanish'
snapshot.conversation_count = 1
const submissions = [
  { text: '¿Dónde está Ana?', skills: ['questions_answers', 'identify_describe'], effort: [] as string[] },
  { text: '¿Dónde estaba Ana ayer?', skills: ['questions_answers', 'identify_describe', 'past_reference'], effort: ['questions_answers', 'identify_describe'] },
  { text: '¿Dónde estaba Ana ayer?', skills: ['questions_answers', 'identify_describe', 'past_reference'], effort: [] as string[] },
]
submissions.forEach((submission, index) => {
  const attempt = `preview-${index}`
  const record: SkillRecord = {
    attempt_id: attempt, session_id: 'preview', turn_id: index + 1, message_id: index + 1,
    replaces_message_id: index ? index : null, construct_registry_hash: snapshot.construct_registry_hash,
    mapping_error: null, support_step: null, chat_id: 'preview', learner_id: snapshot.learner_id,
    target: snapshot.target, variety: 'spanish-spain', native: 'english', source: submission.text,
    input: { modality: 'text', suggestion: false, scaffold: false, revision: index > 0 },
    at_secs: 1790251200 + index * 60, model: 'synthetic-preview', provider_mode: 'fixture',
    catalog_version: snapshot.catalog_version, prompt_version: 'jev-skill-presence-1', status: 'complete',
    assessment_adapter: 'jev_choice', error: null,
    assessment: { judgments: submission.skills.map(skill => ({ skill_id: skill, presence: 'direct', evidence_kind: 'whole_message', quotes: [], rationale: '' })) },
  }
  snapshot.records.push(record)
  if (index === 2) return // Exact resend: recorded observation, no new credit.
  for (const skill of submission.skills) {
    const effort = Number(submission.effort.includes(skill)), experience = 1 - effort
    const event = { id: `${attempt}:${skill}`, attemptId: attempt, constructId: skill, kind: effort ? 'effort' : 'experience', tier: effort ? 2 : 1, xp: 1, experience, effort, quote: submission.text, support: 'not_weighted', difficulty: 'not_weighted', novelty: 'not_weighted', policyHash: 'experience-effort-1', atSecs: BigInt(record.at_secs), claimed: true }
    snapshot.profile.credits.push({ attempt_id: attempt, skill_id: skill, xp: 1, experience, effort, event })
    const progress = snapshot.profile.skills.find(item => item.skill_id === skill)!
    progress.xp++; progress.experience += experience; progress.effort += effort; progress.checked = true
    snapshot.profile.xp++
  }
})
mockIPC(command => {
  if (command === 'get_practice_overview') return { languages: [{ name: 'Spanish', endonym: 'Español', snapshot }] }
  throw new Error(`Unsupported preview command: ${command}`)
})
function Preview() {
  const [report, setReport] = useState(new URLSearchParams(location.search).has('report'))
  const [locale, setLocale] = useState('english')
  return <I18nProvider locale={locale}><main style={{ maxWidth: 1100, margin: '24px auto', padding: 20 }}>
    <h1>Experience and effort</h1>
    <p>Component review · synthetic observations · no AI calls or saved application changes.</p>
    <p>First message: 2 experience. Changed retry: 1 experience + 2 effort. Unchanged retry: 0. Total: 5 XP.</p>
    <label>Interface language <select value={locale} onChange={event => setLocale(event.target.value)}>{['english','spanish','arabic','mandarin','french','german','portuguese'].map(id => <option key={id}>{id}</option>)}</select></label>
    <button onClick={() => setReport(true)}>Open progress report</button>
    <SkillListView snapshot={snapshot} demonstration refresh={() => {}} save={async () => {}} saving={false} onPractice={() => {}} />
    {report && <ProgressSummary snapshot={snapshot} onClose={() => setReport(false)} />}
  </main></I18nProvider>
}
createRoot(document.getElementById('root')!).render(<Preview />)
