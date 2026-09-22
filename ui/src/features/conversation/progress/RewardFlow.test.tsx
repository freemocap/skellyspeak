import { SKILL_CATALOG_VERSION } from '../../../generated/contracts'
// @vitest-environment jsdom
import { useContext, useRef } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { RewardPresentationProvider } from './RewardPresentation'
import { RewardInspectionContext } from './RewardInspectionContext'
import { SkillRewards } from './SkillRewards'
import { InlineXpBadge } from './InlineXpBadge'
import { SkillEvidenceContext } from '../../../state/learning/useSkillEvidence'
import { skillDemo } from '../../../domain/learning/catalog/skillDemo'
import { messageRewardEvidence } from '../../../domain/learning/evidence/message-evidence'
import { unreportedInput, type SkillSnapshot } from '../../../domain/learning/evidence/skills'

vi.mock('../../../platform/audio/reward-sounds', () => ({ playRewardSound: vi.fn() }))
vi.mock('../../../platform/ipc/rewards', () => ({ claimRewardEvents: vi.fn(async (_target: string, ids: string[]) => ids.map(id => ({ id }))) }))
import { playRewardSound } from '../../../platform/audio/reward-sounds'
import { claimRewardEvents } from '../../../platform/ipc/rewards'

function Points({ snapshot }: { snapshot: SkillSnapshot }) {
  const inspection = useContext(RewardInspectionContext)!
  return messageRewardEvidence(snapshot, 'chat', 1, 'this cup').map(item => <InlineXpBadge generation={0} key={item.id} item={item} onOpen={() => inspection.open([item], 1, 'this cup')} />)
}
function Fixture({ snapshot }: { snapshot: SkillSnapshot }) {
  const workspace = useRef<HTMLDivElement>(null)
  return <SkillEvidenceContext value={{ snapshot, error: null }}>
    <RewardPresentationProvider fastMode workspace={workspace} chatId="chat" active>
      <div ref={workspace}><div className="stream"><Points snapshot={snapshot} /></div><div className="composer" /><SkillRewards chatId="chat" active /></div>
    </RewardPresentationProvider>
  </SkillEvidenceContext>
}

it.each(['new review', 'late credit', 'Jev whole-message', 'Jev reduced motion'])('presents %s in a cramped viewport and opens only the clicked point card', async source => {
  localStorage.clear()
  vi.useFakeTimers()
  vi.mocked(playRewardSound).mockClear()
  vi.mocked(claimRewardEvents).mockClear()
  const media = vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: !query.includes('prefers-reduced-motion') || source !== 'Jev whole-message', addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList))
  const originalAnimate = Element.prototype.animate
  Element.prototype.animate = vi.fn(() => {
    const animation = { onfinish: null as null | (() => void), cancel: () => window.clearTimeout(timer) }
    const timer = window.setTimeout(() => animation.onfinish?.(), 50)
    return animation as unknown as Animation
  })
  const bounds = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (this.classList.contains('stream')) return new DOMRect(10, 100, 390, 5)
    if (this.classList.contains('composer')) return new DOMRect(10, 105, 390, 545)
    return new DOMRect(10, 100, 390, 550)
  })
  const initial = structuredClone(skillDemo)
  if (source.startsWith('Jev')) initial.profile.rules_version = 2
  const earned = structuredClone(initial)
  const skills = earned.catalog.filter(item => item.kind === 'skill').slice(0, 2)
  earned.records = [{ attempt_id: 'a', session_id: 's', turn_id: 1, message_id: 1, replaces_message_id: null, construct_registry_hash: 'fixture-registry', mapping_error: null, support_step: null, chat_id: 'chat', learner_id: 'demo', target: 'spanish-spain', native: 'english', source: 'this cup', input: unreportedInput(), at_secs: 1, model: 'test', provider_mode: 'hosted', catalog_version: SKILL_CATALOG_VERSION, prompt_version: 'test', status: 'complete', error: null, assessment: { judgments: skills.map(skill => ({ skill_id: skill.id, outcome: 'demonstrated', quotes: ['this cup'], rationale: `Evidence for ${skill.label}` })) } }]
  if (source.startsWith('Jev')) {
    earned.records[0].assessment_adapter = 'jev_choice'
    earned.records[0].assessment!.judgments.forEach(item => { item.evidence_kind = 'whole_message'; item.quotes = []; item.rationale = '' })
  }
  earned.profile.credits = skills.map(skill => ({ attempt_id: 'a', skill_id: skill.id, xp: 10 }))
  skills.forEach(skill => { earned.profile.skills.find(item => item.skill_id === skill.id)!.xp = 10 })
  earned.profile.xp = 20
  if (source === 'late credit') initial.records = structuredClone(earned.records)
  const view = render(<Fixture snapshot={initial} />)
  try {
    await act(async () => view.rerender(<Fixture snapshot={earned} />))
    expect(screen.queryByRole('dialog', { name: 'XP details' })).toBeNull()
    expect(screen.getByRole('status', { name: 'XP saved' })).toBeVisible()
    for (let step = 0; step < 6; step++) act(() => vi.advanceTimersByTime(600))
    expect(screen.queryByRole('dialog', { name: 'XP details' })).toBeNull()
    expect(playRewardSound).toHaveBeenCalledWith(expect.objectContaining({ kind: 'xp' }), expect.any(HTMLElement))
    if (source.startsWith('Jev')) expect(claimRewardEvents).toHaveBeenCalledOnce()
    const points = screen.getAllByRole('button', { name: /Inspect 10 XP/ })
    fireEvent.click(points[0])
    expect(screen.getAllByRole('button', { name: /Inspect 10 XP/ })).toHaveLength(1)
    const card = screen.getByRole('dialog', { name: 'XP details' })
    expect(parseFloat(document.querySelector<HTMLElement>('.floating-reward')!.style.maxHeight)).toBeGreaterThanOrEqual(120)
    expect(within(card).getByText(skills[0].label)).toBeVisible()
    expect(within(card).queryByText(/Whole-message assessment|Total credited/)).toBeNull()
    expect(within(card).queryByText(skills[1].label)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Close XP details' }))
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.queryByRole('dialog', { name: 'XP details' })).toBeNull()
    expect(screen.getAllByRole('button', { name: /Inspect 10 XP/ })).toHaveLength(1)
  } finally { view.unmount(); bounds.mockRestore(); media.mockRestore(); Element.prototype.animate = originalAnimate; vi.useRealTimers() }
})
