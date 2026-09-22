import { ConversationProgress } from '../src/features/conversation/progress/ConversationProgress'
/** Production chat/reward components; synthetic session-only credits, no AI calls. */
import { mockIPC } from '@tauri-apps/api/mocks'
import { createRoot } from 'react-dom/client'
import { useRef, useState } from 'react'
import { TurnView } from '../src/features/conversation/messages/TurnView'
import { RewardPresentationProvider } from '../src/features/conversation/progress/RewardPresentation'
import { SkillRewards } from '../src/features/conversation/progress/SkillRewards'
import { SkillEvidenceContext } from '../src/state/learning/useSkillEvidence'
import { PracticeContext } from '../src/features/conversation/session/PracticeContext'
import { skillDemo } from '../src/domain/learning/catalog/skillDemo'
import { unreportedInput } from '../src/domain/learning/evidence/skills'
import { configureRewardSounds, unlockRewardAudio, setRewardVolume } from '../src/platform/audio/reward-sounds'
import '../src/styles/index.css'
mockIPC((command, args) => {
  if (command === 'claim_reward_events') return (args as { ids: string[] }).ids.map(id => ({ id }))
  throw new Error('Unsupported preview action: ' + command)
})
function Preview() {
  const workspace = useRef<HTMLDivElement>(null)
  const [fast, setFast] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [snapshot, setSnapshot] = useState(() => { const s = structuredClone(skillDemo); s.profile.rules_version = 2; return s })
  const source = 'Hola, ¿cómo estás?'
  const earn = () => {
    configureRewardSounds(enabled ? 'yes' : 'no', false); setRewardVolume(.2); unlockRewardAudio()
    setSnapshot(previous => {
      const next = structuredClone(previous)
      const skills = next.catalog.filter(item => ['greeting', 'question'].includes(item.id))
      const attempt = `preview-spans-${next.records.length}`
      next.records.push({ attempt_id: attempt, session_id: 'preview', turn_id: 1, message_id: 1, replaces_message_id: null, construct_registry_hash: next.construct_registry_hash, mapping_error: null, support_step: null, chat_id: 'preview', learner_id: next.learner_id, target: next.target, native: 'english', source, input: { ...unreportedInput(), modality: 'speech_transcript' }, at_secs: 1, model: 'typesafe/jev-1.13', provider_mode: 'custom', catalog_version: next.catalog_version, prompt_version: 'jev-choice-assessment-1', assessment_adapter: 'jev_choice', status: 'complete', error: null, assessment: { judgments: skills.map(skill => ({ skill_id: skill.id, outcome: 'demonstrated', quotes: [skill.id === 'greeting' ? 'Hola' : '¿cómo estás?'], rationale: '', evidence_kind: 'quoted' })) } })
      for (const skill of skills) { next.profile.credits.push({ attempt_id: attempt, skill_id: skill.id, xp: 10 }); next.profile.skills.find(item => item.skill_id === skill.id)!.xp += 10 }
      next.profile.xp += 20
      return next
    })
  }
  const noop = () => {}
  return <main style={{ maxWidth: 700, margin: '24px auto', padding: 16 }}>
    <p>Jev reward flow · synthetic preview · no saved data or AI calls</p>
    <button className="btn" onClick={earn}>Receive 20 XP</button>
    <label><input type="checkbox" checked={fast} onChange={e => setFast(e.target.checked)} />Fast mode</label>
    <label><input type="checkbox" checked={enabled} onChange={e => { setEnabled(e.target.checked); configureRewardSounds(e.target.checked ? 'yes' : 'no', false) }} />XP effects</label>
    <SkillEvidenceContext value={{ snapshot, error: null }}><PracticeContext value={{ chatId: 'preview', selectionVersion: 0, selected: null, select: noop }}>
      <RewardPresentationProvider enabled={enabled} workspace={workspace} chatId="preview" active fastMode={fast}>
        <div ref={workspace} style={{ position: 'relative', minHeight: 480 }}><div className="reward-effects-rail" data-reward-surface /><div className="stream" style={{ minHeight: 400 }}>
          <TurnView turn={{ id: 1, user: source, pendingText: '', assistant: null }} reviewing={false} focused={false} ttsReady={false} speaking={false} revealed={new Set()} showRomanization={false} alwaysRomanize={false} alwaysPronunciation={false} autoTranslate={false} rtl={false} onEditUser={noop} onReveal={noop} onBubbleTap={noop} onSpeak={noop} onPopup={noop} onInspect={noop} onToggleReveal={noop} onAskCoach={noop} />
        </div><SkillRewards chatId="preview" active /><aside className="break" style={{ height: 320 }}><ConversationProgress chatId="preview" /></aside></div>
      </RewardPresentationProvider>
    </PracticeContext></SkillEvidenceContext>
  </main>
}
createRoot(document.getElementById('root')!).render(<Preview />)
