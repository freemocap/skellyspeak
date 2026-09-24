import { SKILL_CATALOG_VERSION } from '../../../generated/contracts'
// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { RewardPresentationProvider } from './RewardPresentation'
import { SkillRewards } from './SkillRewards'
import { XpChip } from './XpChip'
import { XP_CARD_HOLD_MS } from './XpArrivalCard'
import { SkillEvidenceContext } from '../../../state/learning/useSkillEvidence'
import { skillDemo } from '../../../domain/learning/catalog/skillDemo'
import { unreportedInput, type SkillSnapshot } from '../../../domain/learning/evidence/skills'

vi.mock('../../../domain/input/back', () => ({ openOverlay: () => () => {} }))
vi.mock('../../../platform/audio/reward-sounds', () => ({ playRewardSound: vi.fn() }))
vi.mock('../../../platform/ipc/rewards', () => ({ claimRewardEvents: vi.fn(async (_target: string, ids: string[]) => ids.map(id => ({ id }))) }))
import { playRewardSound } from '../../../platform/audio/reward-sounds'
import { claimRewardEvents } from '../../../platform/ipc/rewards'

function Fixture({ snapshot, fastMode, enabled = true }: { snapshot: SkillSnapshot; fastMode: boolean; enabled?: boolean }) {
  return <SkillEvidenceContext value={{ snapshot, error: null }}>
    <RewardPresentationProvider enabled={enabled} fastMode={fastMode} chatId="chat" active>
      <header className="chat-head"><XpChip chatId="chat" /></header>
      <div className="stream" />
      <SkillRewards chatId="chat" active />
    </RewardPresentationProvider>
  </SkillEvidenceContext>
}

/** Credits `count` skills for one message, each with its own attempt so they arrive as separate cards. */
function earn(base: SkillSnapshot, count: number, xp = 10): SkillSnapshot {
  const next = structuredClone(base)
  const skills = next.catalog.filter(item => item.kind === 'skill').slice(0, count)
  skills.forEach((skill, index) => {
    const attempt = `a${index}`
    next.records.push({ attempt_id: attempt, session_id: 's', turn_id: 1, message_id: 1, replaces_message_id: null, construct_registry_hash: 'fixture-registry', mapping_error: null, support_step: null, chat_id: 'chat', learner_id: 'demo', target: 'spanish-spain', native: 'english', source: 'this cup', input: unreportedInput(), at_secs: 1 + index, model: 'test', provider_mode: 'hosted', catalog_version: SKILL_CATALOG_VERSION, prompt_version: 'test', status: 'complete', error: null, assessment: { judgments: [{ skill_id: skill.id, outcome: 'demonstrated', quotes: ['this cup'], rationale: `Evidence for ${skill.label}` }] } })
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

const card = () => screen.queryByRole('status', { name: 'XP saved' })
const chip = () => screen.getByRole('button', { name: 'Conversation XP' })

it('opens the card inside the header anchor and closes it after two seconds in Fast mode', () => {
  const view = render(<Fixture snapshot={skillDemo} fastMode />)
  expect(chip()).toHaveTextContent(`${skillDemo.profile.xp} XP`)
  view.rerender(<Fixture snapshot={earn(skillDemo, 1)} fastMode />)
  expect(card()).toBeVisible()
  expect(card()!.closest('.xp-chip-anchor')).toContainElement(chip())
  expect(document.querySelector('.stream')!.previousElementSibling).toHaveClass('chat-head')
  expect(chip()).toHaveTextContent('+10 XP')
  expect(playRewardSound).toHaveBeenCalledOnce()
  expect(playRewardSound).toHaveBeenCalledWith({ kind: 'xp', xp: 10 }, card())
  act(() => vi.advanceTimersByTime(XP_CARD_HOLD_MS - 1))
  expect(card()).toBeVisible()
  act(() => vi.advanceTimersByTime(1))
  expect(card()).toBeNull()
  expect(chip()).toHaveTextContent(`${skillDemo.profile.xp + 10} XP`)
  view.unmount()
})

it('holds the card while hovered and restarts the wait when released', () => {
  const view = render(<Fixture snapshot={skillDemo} fastMode />)
  view.rerender(<Fixture snapshot={earn(skillDemo, 1)} fastMode />)
  fireEvent.pointerEnter(card()!)
  act(() => vi.advanceTimersByTime(XP_CARD_HOLD_MS * 3))
  expect(card()).toBeVisible()
  expect(card()!.querySelector('.xp-arrival-timer')).toBeNull()
  fireEvent.pointerLeave(card()!)
  act(() => vi.advanceTimersByTime(XP_CARD_HOLD_MS - 1))
  expect(card()).toBeVisible()
  act(() => vi.advanceTimersByTime(1))
  expect(card()).toBeNull()
  view.unmount()
})

it('keeps a card open on request and shows queued awards one at a time', () => {
  const view = render(<Fixture snapshot={skillDemo} fastMode />)
  const earned = earn(skillDemo, 2)
  const [first, second] = earned.catalog.filter(item => item.kind === 'skill')
  view.rerender(<Fixture snapshot={earned} fastMode />)
  expect(within(card()!).getByText(first.label)).toBeVisible()
  expect(within(card()!).getByText('1 more')).toBeVisible()
  fireEvent.click(within(card()!).getByRole('button', { name: 'Keep' }))
  act(() => vi.advanceTimersByTime(XP_CARD_HOLD_MS * 3))
  expect(within(card()!).getByText(first.label)).toBeVisible()
  fireEvent.click(within(card()!).getByRole('button', { name: 'Close XP details' }))
  expect(within(card()!).getByText(second.label)).toBeVisible()
  expect(within(card()!).queryByText('1 more')).toBeNull()
  act(() => vi.advanceTimersByTime(XP_CARD_HOLD_MS))
  expect(card()).toBeNull()
  view.unmount()
})

it('keeps cards until closed when Fast mode is off', () => {
  const view = render(<Fixture snapshot={skillDemo} fastMode={false} />)
  view.rerender(<Fixture snapshot={earn(skillDemo, 1)} fastMode={false} />)
  expect(within(card()!).queryByRole('button', { name: 'Keep' })).toBeNull()
  act(() => vi.advanceTimersByTime(XP_CARD_HOLD_MS * 5))
  expect(card()).toBeVisible()
  fireEvent.click(within(card()!).getByRole('button', { name: 'Close XP details' }))
  expect(card()).toBeNull()
  view.unmount()
})

it('reports milestone crossings and shows the added part of the meter', () => {
  const base = structuredClone(skillDemo)
  const skill = base.catalog.filter(item => item.kind === 'skill')[0]
  base.profile.skills.find(item => item.skill_id === skill.id)!.xp = 45
  const view = render(<Fixture snapshot={base} fastMode />)
  view.rerender(<Fixture snapshot={earn(base, 1)} fastMode />)
  expect(within(card()!).getByText('50 XP milestone')).toBeVisible()
  expect(playRewardSound).toHaveBeenCalledWith({ kind: 'milestone' }, card())
  const meter = within(card()!).getByRole('progressbar')
  expect(meter).toHaveAttribute('aria-valuenow', '5')
  expect(meter).toHaveAttribute('aria-valuetext', '55 XP; next milestone 100')
  expect(meter.querySelector<HTMLElement>('.xp-meter-earlier')!.style.width).toBe('0%')
  expect(meter.querySelector<HTMLElement>('.xp-meter-added')!.style.width).toBe('10%')
  view.unmount()
})

it('lists this conversation’s awards from the chip after the card has gone', () => {
  const earned = earn(skillDemo, 2)
  earned.records.push({ ...structuredClone(earned.records[0]), attempt_id: 'elsewhere', chat_id: 'other' })
  earned.profile.credits.push({ attempt_id: 'elsewhere', skill_id: earned.records[0].assessment!.judgments[0].skill_id, xp: 99 })
  const view = render(<Fixture snapshot={skillDemo} fastMode />)
  view.rerender(<Fixture snapshot={earned} fastMode />)
  act(() => vi.advanceTimersByTime(XP_CARD_HOLD_MS))
  act(() => vi.advanceTimersByTime(XP_CARD_HOLD_MS))
  expect(card()).toBeNull()
  fireEvent.click(chip())
  const ledger = screen.getByRole('dialog', { name: 'Conversation XP' })
  expect(within(ledger).getByText('+20 XP')).toBeVisible()
  expect(within(ledger).getAllByRole('button')).toHaveLength(2)
  expect(within(ledger).queryByText('+99')).toBeNull()
  fireEvent.click(within(ledger).getAllByRole('button')[0])
  expect(screen.getByRole('heading', { name: 'Message XP' })).toBeInTheDocument()
  view.unmount()
})

it('keeps the chip and list when effects are off, and does not replay arrivals on re-enable', () => {
  const view = render(<Fixture snapshot={skillDemo} fastMode enabled={false} />)
  const earned = earn(skillDemo, 1)
  view.rerender(<Fixture snapshot={earned} fastMode enabled={false} />)
  expect(card()).toBeNull()
  expect(playRewardSound).not.toHaveBeenCalled()
  expect(chip()).toHaveTextContent(`${earned.profile.xp} XP`)
  view.rerender(<Fixture snapshot={earned} fastMode enabled />)
  expect(card()).toBeNull()
  view.unmount()
})

it('shows Jev awards only after their durable claim', async () => {
  const base = structuredClone(skillDemo)
  base.profile.rules_version = 2
  const view = render(<Fixture snapshot={base} fastMode />)
  await act(async () => view.rerender(<Fixture snapshot={earn(base, 1)} fastMode />))
  expect(claimRewardEvents).toHaveBeenCalledOnce()
  expect(card()).toBeVisible()
  view.unmount()
})
