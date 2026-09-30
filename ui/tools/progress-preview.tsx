import { mockIPC } from '@tauri-apps/api/mocks'
import { ProfileOverlay } from '../src/app/shell/ProfileOverlay'
import { DrillLayout } from '../src/features/drill/DrillLayout'
import { useNavigationStore } from '../src/state/navigation/navigation'
/** Production counters and shell, with local fixture data and manual increments. */
import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import { TopBar } from '../src/app/shell/TopBar'
import { XpChip } from '../src/features/conversation/progress/XpChip'
import { SkillEvidenceContext } from '../src/state/learning/useSkillEvidence'
import { EffortProgressContext } from '../src/state/learning/EffortProgressContext'
import { useSkillEvidenceStore } from '../src/state/learning/skill-evidence'
import { useSettingsStore } from '../src/state/settings/settings'
import { skillDemo } from '../src/domain/learning/catalog/skillDemo'
import { unreportedInput } from '../src/domain/learning/evidence/skills'
import { PREVIEW_SETTINGS } from './preview-settings'
import type { EffortProgress } from '../src/generated/contracts'
import '../src/styles/index.css'
const reportSnapshot = structuredClone(skillDemo)
const snapshot = structuredClone(skillDemo)
// Sample credited messages in the preview conversation, so its card lists skills.
const sampleSkills = snapshot.catalog.filter(node => node.kind === 'skill').slice(0, 6)
;[[0, 1], [0, 2], [1, 2], [0, 3], [2, 4], [3, 5], [1, 6], [4, 6], [5, 7]].forEach(([skill, message], index) => {
  const attempt = `preview-${index}`
  snapshot.records.push({ attempt_id: attempt, session_id: 's', turn_id: message, message_id: message, replaces_message_id: null, construct_registry_hash: 'fixture-registry', mapping_error: null, support_step: null, chat_id: 'preview', learner_id: 'demo', target: snapshot.target, native: 'english', source: 'Quisiera un café, por favor.', input: unreportedInput(), at_secs: 1790000000 + index * 60, model: 'preview', provider_mode: 'hosted', catalog_version: snapshot.catalog_version, prompt_version: 'preview', status: 'complete', error: null, assessment: { judgments: [{ skill_id: sampleSkills[skill].id, presence: 'direct', quotes: ['Quisiera un café'], rationale: 'Preview evidence.' }] } })
  snapshot.profile.credits.push({ attempt_id: attempt, skill_id: sampleSkills[skill].id, xp: 1 })
  snapshot.profile.skills.find(item => item.skill_id === sampleSkills[skill].id)!.xp += 1
  snapshot.profile.xp += 1
})
const activity = ['partner_understood', 'revisions_sent', 'practice_attempts', 'no_issues_flagged'].map((dimension, i) => ({ dimension, total: [128,24,306,82][i], lastSevenDays: [12,4,28,7][i], activeDays: [18,8,21,15][i], firstAt: '2026-09-01T12:00:00Z', lastAt: '2026-09-29T12:00:00Z' }))
mockIPC((command) => {
  // The report validates credits against full evidence; the chat's sample credits are card-only.
  if (command === 'get_practice_overview') return { languages: [{ name: 'Spanish', endonym: 'Español', snapshot: reportSnapshot }] }
  if (command === 'get_language_totals') return [
    { target: snapshot.target, name: 'Spanish', nativeName: 'Español', languageTag: 'es', xp: snapshot.profile.xp, conversations: 4, partnerUnderstood: 128, noIssuesFlagged: 82, revisionsSent: 24, practiceAttempts: 306 },
    { target: 'french', name: 'French', nativeName: 'Français', languageTag: 'fr', xp: 212, conversations: 11, partnerUnderstood: 64, noIssuesFlagged: 40, revisionsSent: 18, practiceAttempts: 45 },
    { target: 'mandarin', name: 'Mandarin', nativeName: '中文', languageTag: 'zh', xp: 37, conversations: 2, partnerUnderstood: 9, noIssuesFlagged: 3, revisionsSent: 7, practiceAttempts: 120 },
  ]
  if (command === 'get_effort_progress') return { target: snapshot.target, partnerUnderstood: 2, revisionsSent: 1, practiceAttempts: 0, noIssuesFlagged: 1, recent: [] }
  if (command === 'get_effort_report') return { target: snapshot.target, activity, entries: [{ id: 'preview-credit', dimension: 'practice_attempts', createdAt: '2026-09-29T12:00:00Z', sourceText: 'Quisiera un café, por favor.' }], next: null }
  throw new Error(`Preview has no fixture for ${command}`)
})
useSettingsStore.setState({ settings: { ...PREVIEW_SETTINGS, target_language: snapshot.target, my_languages: [snapshot.target, 'french', 'mandarin'] }, revision: 1 })
useSkillEvidenceStore.setState({ snapshot, scope: 1 })
function Preview() {
  const practice = useNavigationStore(state => state.practiceView === 'drill')
  const [value, setValue] = useState<EffortProgress>({ target: snapshot.target, partnerUnderstood: 128, revisionsSent: 24, practiceAttempts: 306, noIssuesFlagged: 82, recent: [] })
  return <EffortProgressContext value={{ target: snapshot.target, value, error: null, arrived: [], effects: true }}><SkillEvidenceContext value={{ snapshot, error: null }}>
    <div className="app" data-place="chat"><TopBar languagePicker={<button className="learning-picker"><span className="learning-picker-identity"><span>Español</span></span><span>▾</span></button>} />
      <ProfileOverlay /><div className="content">{practice ? <section className="drill-page"><DrillLayout items={[]} empty={false} selectedId={null} locked={false} onSelect={() => {}} attempt={null} rtl={false} rail={null} report={null} dock={<button className="btn" onClick={() => setValue(previous => ({ ...previous, practiceAttempts: previous.practiceAttempts + 1 }))}>Record practice +1</button>}><main className="drill-stage"><h2>Practice phrase</h2><p>Quisiera un café, por favor.</p></main></DrillLayout></section> : <section className="chat" style={{ height: '100%', minHeight: 0 }}>
        <div className="chat-head"><strong className="conversation-title">María</strong><XpChip chatId="preview" /><button className="btn">⚙</button></div>
        <div className="stream"><div className="msg bot chat-message">¿Qué te gustaría practicar hoy?</div><div className="msg me chat-message">Quisiera un café, por favor.</div></div>
        <div style={{ padding: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => setValue(previous => ({ ...previous, practiceAttempts: previous.practiceAttempts + 1 }))}>Record practice +1</button>
          <button className="btn" onClick={() => setValue(previous => ({ ...previous, revisionsSent: previous.revisionsSent + 1, partnerUnderstood: previous.partnerUnderstood + 1 }))}>Resend +1</button>
          <button className="btn" onClick={() => setValue(previous => ({ ...previous, partnerUnderstood: 1234567, revisionsSent: 54321, practiceAttempts: 7654321, noIssuesFlagged: 123456 }))}>Large totals</button>
        </div>
      </section>}</div>
    </div>
  </SkillEvidenceContext></EffortProgressContext>
}
createRoot(document.getElementById('root')!).render(<Preview />)
