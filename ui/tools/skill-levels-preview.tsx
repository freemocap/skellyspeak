/** Production skill-level surfaces with local fixture data: the top bar's level
 * chip, the coach panel's Skills tab, a wide panel as on the Skills page, and a
 * new learner. `?theme=dark` renders the dark theme. */
import { createRoot } from 'react-dom/client'
import { mockIPC } from '@tauri-apps/api/mocks'
import { TopBar } from '../src/app/shell/TopBar'
import { CoachPanelTabs } from '../src/features/conversation/coaching/CoachPanelTabs'
import { ConversationProgress } from '../src/features/conversation/progress/ConversationProgress'
import { PracticeContext } from '../src/features/conversation/session/PracticeContext'
import { SkillLevelsPanel } from '../src/features/skills/levels/SkillLevelsPanel'
import { SkillEvidenceContext } from '../src/state/learning/useSkillEvidence'
import { EffortProgressContext } from '../src/state/learning/EffortProgressContext'
import { useSkillEvidenceStore } from '../src/state/learning/skill-evidence'
import { useSettingsStore } from '../src/state/settings/settings'
import { skillDemo } from '../src/domain/learning/catalog/skillDemo'
import { conversationEvidence, unreportedInput, type SkillSnapshot } from '../src/domain/learning/evidence/skills'
import { XpChip } from '../src/features/conversation/progress/XpChip'
import { PREVIEW_SETTINGS } from './preview-settings'
import '../src/styles/index.css'

const theme = new URLSearchParams(location.search).get('theme')
if (theme) document.documentElement.dataset.theme = theme

/** Credited messages per skill, in catalog order: a level-4 learner whose weakest skills have 5. */
const POINTS = [9, 6, 11, 5, 7, 5, 13, 8, 6, 9, 5, 6]
/** How many of each skill's credits came from the preview conversation. */
const IN_CONVERSATION = [1, 0, 2, 1, 1, 0, 2, 0, 1, 2, 0, 1]

function learner(points: number[], inConversation: number[]): SkillSnapshot {
  const snapshot = structuredClone(skillDemo)
  const skills = snapshot.catalog.filter(node => node.kind === 'skill')
  if (skills.length !== points.length) throw new Error(`Fixture has ${points.length} skills; catalog has ${skills.length}`)
  let message = 0
  skills.forEach((skill, index) => {
    for (let n = 0; n < points[index]; n++) {
      const attempt = `${skill.id}-${n}`
      const chat = n < inConversation[index] ? 'preview' : 'earlier'
      const xp = 10 + ((index * 7 + n * 3) % 9)
      snapshot.records.push({ attempt_id: attempt, session_id: 's', turn_id: message, message_id: message, replaces_message_id: null, construct_registry_hash: snapshot.construct_registry_hash, mapping_error: null, support_step: null, chat_id: chat, learner_id: 'demo', target: snapshot.target, native: 'english', source: 'Quisiera un café, por favor.', input: unreportedInput(), at_secs: 1790000000 + message * 60, model: 'preview', provider_mode: 'hosted', catalog_version: snapshot.catalog_version, prompt_version: 'preview', status: 'complete', error: null, assessment: { judgments: [{ skill_id: skill.id, presence: 'direct', quotes: ['Quisiera un café'], rationale: 'Preview evidence.' }] } })
      snapshot.profile.credits.push({ attempt_id: attempt, skill_id: skill.id, xp })
      snapshot.profile.skills.find(item => item.skill_id === skill.id)!.xp += xp
      snapshot.profile.xp += xp
      message++
    }
  })
  return snapshot
}

const snapshot = learner(POINTS, IN_CONVERSATION)
const newcomer = structuredClone(skillDemo)

mockIPC((command) => {
  if (command === 'get_language_totals') return [{ target: snapshot.target, name: 'Spanish', nativeName: 'Español', languageTag: 'es', xp: snapshot.profile.xp, conversations: 4, partnerUnderstood: 128, noIssuesFlagged: 82, explorations: 0, bot: 0, revisionsSent: 24, practiceAttempts: 306 }]
  if (command === 'get_effort_progress') return { target: snapshot.target, partnerUnderstood: 2, revisionsSent: 1, practiceAttempts: 0, noIssuesFlagged: 1, explorations: 0, bot: 0, recent: [] }
  throw new Error(`Preview has no fixture for ${command}`)
})
useSettingsStore.setState({ settings: { ...PREVIEW_SETTINGS, target_language: snapshot.target, my_languages: [snapshot.target] }, revision: 1 })
useSkillEvidenceStore.setState({ snapshot, scope: 1 })

function Preview() {
  const effort = { target: snapshot.target, partnerUnderstood: 128, revisionsSent: 24, practiceAttempts: 306, noIssuesFlagged: 82, explorations: 0, bot: 0, recent: [] }
  return <EffortProgressContext value={{ target: snapshot.target, value: effort, error: null, arrived: [], effects: false }}>
    <SkillEvidenceContext value={{ snapshot, error: null }}>
      <PracticeContext value={{ chatId: 'preview', selected: null, selectionVersion: 0, select: () => {} }}>
        <div className="app" data-place="chat" style={{ height: 'auto', minHeight: '100vh' }}>
          <TopBar languagePicker={<button className="learning-picker"><span className="learning-picker-identity"><span>Español</span></span><span>▾</span></button>} />
          <div data-preview="chat-head" className="chat-head" style={{ margin: '12px 24px 0' }}><strong className="conversation-title">María</strong><XpChip chatId="preview" /></div>
          <div data-preview="surfaces" style={{ display: 'flex', gap: 24, padding: 24, alignItems: 'flex-start' }}>
            <section data-preview="coach" className="break" style={{ width: 420, height: 1100, flex: 'none', display: 'flex', flexDirection: 'column' }}>
              <CoachPanelTabs tab="skills" onTab={() => {}} />
              <ConversationProgress chatId="preview"><SkillLevelsPanel snapshot={snapshot} conversation={conversationEvidence(snapshot, 'preview')} /></ConversationProgress>
            </section>
            <main data-preview="page" className="skills-page" style={{ flex: 1, minWidth: 0 }}>
              <SkillLevelsPanel snapshot={snapshot} conversation={null} />
            </main>
            <aside data-preview="newcomer" style={{ width: 360, flex: 'none' }}>
              <SkillLevelsPanel snapshot={newcomer} conversation={null} />
            </aside>
          </div>
        </div>
      </PracticeContext>
    </SkillEvidenceContext>
  </EffortProgressContext>
}
createRoot(document.getElementById('root')!).render(<Preview />)
