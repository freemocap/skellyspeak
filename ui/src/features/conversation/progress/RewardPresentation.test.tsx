import { SKILL_CATALOG_VERSION } from '../../../generated/contracts'
// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { RewardPresentationProvider } from './RewardPresentation'
import { SkillRewards } from './SkillRewards'
import { XpChip } from './XpChip'
import { XP_PAYOUT_STEP_MS, XP_PAYOUT_LIFETIME_MS } from './RewardPresentation'
import { MessageXpButton } from './MessageXpButton'
import { PracticeContext } from '../session/PracticeContext'
import { SkillEvidenceContext } from '../../../state/learning/useSkillEvidence'
import { skillDemo } from '../../../domain/learning/catalog/skillDemo'
import { unreportedInput, type SkillSnapshot } from '../../../domain/learning/evidence/skills'

vi.mock('../../../domain/input/back', () => ({ openOverlay: () => () => {} }))
vi.mock('../../../platform/audio/reward-sounds', () => ({ playRewardSound: vi.fn() }))
vi.mock('../../../platform/ipc/rewards', () => ({ claimRewardEvents: vi.fn(async (_target: string, ids: string[]) => ids.map(id => ({ id }))) }))
import { playRewardSound } from '../../../platform/audio/reward-sounds'
import { claimRewardEvents } from '../../../platform/ipc/rewards'

function Fixture({ snapshot, enabled = true }: { snapshot: SkillSnapshot; fastMode: boolean; enabled?: boolean }) {
  return <SkillEvidenceContext value={{ snapshot, error: null }}>
    <RewardPresentationProvider enabled={enabled} chatId="chat" active>
      <header className="chat-head"><XpChip chatId="chat" /></header>
      <PracticeContext value={{ chatId: "chat", selectionVersion: 0, selected: null, select: () => {} }}><div data-reward-message="1"><MessageXpButton messageId={1} source="this cup" /></div></PracticeContext>
      <SkillRewards chatId="chat" active />
    </RewardPresentationProvider>
  </SkillEvidenceContext>
}

/** Credits `count` skills for one message, each with its own attempt. */
function earn(base: SkillSnapshot, count: number, xp = 1): SkillSnapshot {
  const next = structuredClone(base)
  const skills = next.catalog.filter(item => item.kind === 'skill').slice(0, count)
  skills.forEach((skill, index) => {
    const attempt = `a${index}`
    next.records.push({ attempt_id: attempt, session_id: 's', turn_id: 1, message_id: 1, replaces_message_id: null, construct_registry_hash: 'fixture-registry', mapping_error: null, support_step: null, chat_id: 'chat', learner_id: 'demo', target: 'spanish-spain', native: 'english', source: 'this cup', input: unreportedInput(), at_secs: 1 + index, model: 'test', provider_mode: 'hosted', catalog_version: SKILL_CATALOG_VERSION, prompt_version: 'test', status: 'complete', error: null, assessment: { judgments: [{ skill_id: skill.id, presence: 'direct', quotes: ['this cup'], rationale: `Evidence for ${skill.label}` }] } })
    next.profile.credits.push({ attempt_id: attempt, skill_id: skill.id, xp })
    next.profile.skills.find(item => item.skill_id === skill.id)!.xp += xp
    next.profile.xp += xp
  })
  return next
}

let media: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(playRewardSound).mockClear()
  vi.mocked(claimRewardEvents).mockClear()
  HTMLDialogElement.prototype.showModal = function (): void { this.open = true }
  HTMLDialogElement.prototype.close = function (): void { this.open = false }
  media = vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList)
})
afterEach(() => { media.mockRestore(); vi.useRealTimers() })

const counter = () => screen.getByRole('button', { name: 'Message XP' })
it('pays out at the message counter without cards and leaves its report clickable', async () => {
  const view = render(<Fixture snapshot={skillDemo} fastMode />)
  await act(async () => view.rerender(<Fixture snapshot={earn(skillDemo, 3)} fastMode />))
  expect(counter()).toHaveTextContent('0 XP')
  expect(document.querySelector('.xp-arrival-card')).toBeNull()
  act(() => vi.advanceTimersByTime(0))
  expect(counter()).toHaveTextContent('1 XP')
  expect(document.querySelectorAll('.message-xp-coin')).toHaveLength(1)
  act(() => vi.advanceTimersByTime(XP_PAYOUT_STEP_MS * 2))
  expect(counter()).toHaveTextContent('3 XP')
  expect(playRewardSound).toHaveBeenCalledTimes(3)
  act(() => vi.advanceTimersByTime(XP_PAYOUT_LIFETIME_MS))
  expect(document.querySelectorAll('.message-xp-coin')).toHaveLength(0)
  fireEvent.click(counter())
  expect(screen.getByRole('heading', { name: 'Message XP' })).toBeInTheDocument()
})
it('disabling effects clears pending payout and does not replay it when re-enabled', async () => {
  const view = render(<Fixture snapshot={skillDemo} fastMode={false} />)
  const earned = earn(skillDemo, 2)
  await act(async () => view.rerender(<Fixture snapshot={earned} fastMode={false} />))
  view.rerender(<Fixture snapshot={earned} fastMode={false} enabled={false} />)
  act(() => vi.advanceTimersByTime(2000))
  expect(counter()).toHaveTextContent('2 XP')
  expect(playRewardSound).not.toHaveBeenCalled()
  view.rerender(<Fixture snapshot={earned} fastMode={false} />)
  expect(document.querySelector('.message-xp-coin')).toBeNull()
})
it('completes in normal mode too, and does not replay identical snapshots', async () => {
  const view = render(<Fixture snapshot={skillDemo} fastMode={false} />)
  const earned = earn(skillDemo, 1)
  await act(async () => view.rerender(<Fixture snapshot={earned} fastMode={false} />))
  act(() => vi.advanceTimersByTime(1000))
  view.rerender(<Fixture snapshot={structuredClone(earned)} fastMode={false} />)
  expect(document.querySelector('.message-xp-coin')).toBeNull()
  expect(playRewardSound).toHaveBeenCalledOnce()
})
it('retains the milestone cue at the message counter', async () => {
  const base = structuredClone(skillDemo)
  base.profile.skills[0].xp = 49
  const view = render(<Fixture snapshot={base} fastMode />)
  await act(async () => view.rerender(<Fixture snapshot={earn(base, 1)} fastMode />))
  act(() => vi.advanceTimersByTime(0))
  expect(playRewardSound).toHaveBeenCalledWith({ kind: 'milestone' }, counter())
})
it('finishes without a mounted message anchor instead of blocking later rewards', async () => {
  const view = render(<Fixture snapshot={skillDemo} fastMode />)
  document.querySelector('[data-reward-message]')!.removeAttribute('data-reward-message')
  await act(async () => view.rerender(<Fixture snapshot={earn(skillDemo, 1)} fastMode />))
  act(() => vi.advanceTimersByTime(1000))
  expect(playRewardSound).not.toHaveBeenCalled()
  expect(document.querySelector('.message-xp-coin')).toBeNull()
  expect(counter()).toHaveTextContent('1 XP')
})
