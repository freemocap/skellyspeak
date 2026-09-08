// @vitest-environment jsdom
import { useContext, useRef } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { RewardPresentationProvider } from './RewardPresentation'
import { RewardInspectionContext } from './RewardInspectionContext'
import { SkillRewards } from './SkillRewards'
import { InlineXpBadge } from './InlineXpBadge'
import { SkillEvidenceContext } from '../../hooks/useSkillEvidence'
import { SkillNavigationProvider } from '../../hooks/useSkillNavigation'
import { skillDemo } from '../../lib/skillDemo'
import { messageEvidence } from '../../lib/message-evidence'
import { unreportedInput, type SkillSnapshot } from '../../lib/skills'

function Points({ snapshot }: { snapshot: SkillSnapshot }) {
  const inspection = useContext(RewardInspectionContext)!
  return messageEvidence(snapshot, 'chat', 1, 'this cup').map(item => <InlineXpBadge generation={0} key={item.id} item={item} onOpen={() => inspection.open([item], 1, 'this cup')} />)
}
function Fixture({ snapshot }: { snapshot: SkillSnapshot }) {
  const workspace = useRef<HTMLDivElement>(null)
  return <SkillNavigationProvider><SkillEvidenceContext value={{ snapshot, error: null }}>
    <RewardPresentationProvider fastMode workspace={workspace} chatId="chat" active>
      <div ref={workspace}><div className="stream"><Points snapshot={snapshot} /></div><div className="composer" /><SkillRewards chatId="chat" active /></div>
    </RewardPresentationProvider>
  </SkillEvidenceContext></SkillNavigationProvider>
}

it.each(['new review', 'late credit'])('presents %s in a cramped viewport and opens only the clicked point card', source => {
  vi.useFakeTimers()
  const media = vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList)
  const bounds = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (this.classList.contains('stream')) return new DOMRect(10, 100, 390, 5)
    if (this.classList.contains('composer')) return new DOMRect(10, 105, 390, 545)
    return new DOMRect(10, 100, 390, 550)
  })
  const initial = structuredClone(skillDemo)
  const earned = structuredClone(initial)
  const skills = earned.catalog.filter(item => item.kind === 'skill').slice(0, 2)
  earned.records = [{ attempt_id: 'a', session_id: 's', turn_id: 1, message_id: 1, replaces_message_id: null, chat_id: 'chat', learner_id: 'demo', target: 'es-ES', native: 'en', source: 'this cup', input: unreportedInput(), at_secs: 1, model: 'test', provider_mode: 'hosted', catalog_version: 3, prompt_version: 'test', status: 'complete', error: null, assessment: { judgments: skills.map(skill => ({ skill_id: skill.id, outcome: 'demonstrated', quotes: ['this cup'], rationale: `Evidence for ${skill.label}` })) } }]
  earned.profile.credits = skills.map(skill => ({ attempt_id: 'a', skill_id: skill.id, xp: 10 }))
  skills.forEach(skill => { earned.profile.skills.find(item => item.skill_id === skill.id)!.xp = 10 })
  earned.profile.xp = 20
  if (source === 'late credit') initial.records = structuredClone(earned.records)
  const view = render(<Fixture snapshot={initial} />)
  try {
    view.rerender(<Fixture snapshot={earned} />)
    expect(screen.getAllByRole('dialog', { name: 'XP details' })).toHaveLength(1)
    expect(parseFloat(document.querySelector<HTMLElement>('.floating-reward')!.style.maxHeight)).toBeGreaterThanOrEqual(120)
    for (let step = 0; step < 6; step++) act(() => vi.advanceTimersByTime(600))
    expect(screen.queryByRole('dialog', { name: 'XP details' })).toBeNull()
    const points = screen.getAllByRole('button', { name: /Inspect 10 XP/ })
    fireEvent.click(points[0])
    expect(screen.getAllByRole('button', { name: /Inspect 10 XP/ })).toHaveLength(1)
    const card = screen.getByRole('dialog', { name: 'XP details' })
    expect(within(card).getByText(skills[0].label)).toBeVisible()
    expect(within(card).queryByText(skills[1].label)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Close XP details' }))
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.queryByRole('dialog', { name: 'XP details' })).toBeNull()
    expect(screen.getAllByRole('button', { name: /Inspect 10 XP/ })).toHaveLength(1)
  } finally { view.unmount(); bounds.mockRestore(); media.mockRestore(); vi.useRealTimers() }
})
