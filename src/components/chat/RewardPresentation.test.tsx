import { SkillEvidenceContext } from '../../hooks/useSkillEvidence'
import { skillDemo } from '../../lib/skillDemo'
// @vitest-environment jsdom
import { useContext, useRef } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { RewardPresentationProvider } from './RewardPresentation'
import { RewardInspectionContext } from './RewardInspectionContext'
import { SkillNavigationProvider } from '../../hooks/useSkillNavigation'
import type { MessageEvidence } from '../../lib/message-evidence'
vi.mock('../../lib/back', () => ({ openOverlay: () => () => {} }))
const items = vi.hoisted(() => [{ id: 'a', skillId: 'referent', domainId: 'reference', label: 'Referent', xp: 10, quote: 'this cup', rationale: 'Identifies the cup.', start: 0, end: 8, ambiguous: false, color: '#a32b44', explanation: '' }])
vi.mock('../../lib/message-evidence', () => ({ createMessageEvidenceSelector: () => () => [...items, { ...items[0], id: 'b' }] }))
function Triggers() {
  const controller = useContext(RewardInspectionContext)!
  return <><button onClick={() => controller.open(items as MessageEvidence[], 1, 'this cup')}>Score</button><button onClick={() => controller.open([{ ...items[0], id: 'b' }] as MessageEvidence[], 1, 'this cup')}>Other score</button><button onClick={() => controller.arrive(items as MessageEvidence[], 1, 'this cup')}>Arrive</button><button onClick={() => controller.arrive([{ ...items[0], id: 'b' }] as MessageEvidence[], 1, 'this cup')}>Another arrival</button></>
}
function Fixture({ fastMode }: { fastMode: boolean }) {
  const workspace = useRef<HTMLDivElement>(null)
  return <SkillNavigationProvider><RewardPresentationProvider fastMode={fastMode} workspace={workspace} chatId="chat" active={true}><div ref={workspace}><div className="stream"><Triggers /></div><div data-reward-domain="reference" /></div></RewardPresentationProvider></SkillNavigationProvider>
}
it('grows, holds, and departs on dismissal before flashing the destination', () => {
  const media = vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList)
  const bounds = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 100, 400, 400))
  const animations: { cancel: ReturnType<typeof vi.fn>; onfinish: (() => void) | null }[] = []
  const original = Element.prototype.animate
  Element.prototype.animate = vi.fn(function (this: Element) { const animation = { cancel: vi.fn(), onfinish: null }; if (!this.classList.contains('reward-path-trace')) animations.push(animation); return animation as unknown as Animation })
  const view = render(<Fixture fastMode={false} />)
  try {
    fireEvent.click(screen.getByText('Score'))
    expect(document.querySelector('.floating-reward')).toHaveClass('opening')
    act(() => animations[0].onfinish!())
    expect(document.querySelector('.floating-reward')).toHaveClass('hovering')
    fireEvent.click(screen.getByLabelText('Close XP details'))
    expect(document.querySelector('.floating-reward')).toHaveClass('departing')
    act(() => animations[1].onfinish!())
    expect(animations).toHaveLength(3)
    act(() => animations[2].onfinish!())
    expect(screen.queryByRole('dialog')).toBeNull()
  } finally { view.unmount(); media.mockRestore(); bounds.mockRestore(); Element.prototype.animate = original }
})


it('shows saved mobile progress on dismissal without replaying the same credit', () => {
  vi.useFakeTimers()
  const media = vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList)
  const bounds = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 100, 400, 400))
  const snapshot = structuredClone(skillDemo)
  snapshot.profile.skills.find(skill => skill.skill_id === 'referent')!.xp = 20
  snapshot.profile.xp = 120
  const view = render(<SkillEvidenceContext value={{ snapshot, error: null }}><Fixture fastMode={false} /></SkillEvidenceContext>)
  try {
    fireEvent.click(screen.getByText('Score'))
    fireEvent.click(screen.getByLabelText('Close XP details'))
    expect(screen.getByRole('status', { name: 'XP saved' })).toHaveTextContent('+10 XP · 120 XP total')
    act(() => vi.advanceTimersByTime(2800))
    expect(screen.queryByRole('status', { name: 'XP saved' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Score'))
    fireEvent.click(screen.getByLabelText('Close XP details'))
    expect(screen.queryByRole('status', { name: 'XP saved' })).not.toBeInTheDocument()
  } finally { view.unmount(); media.mockRestore(); bounds.mockRestore(); vi.useRealTimers() }
})


it('pauses Fast mode cards for half a second before departure and holds a reopened card', () => {
  vi.useFakeTimers()
  const media = vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList)
  const bounds = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 100, 400, 400))
  const animations: { cancel: ReturnType<typeof vi.fn>; onfinish: (() => void) | null }[] = []
  const original = Element.prototype.animate
  const animate = vi.fn<Element['animate']>(function (this: Element) { const animation = { cancel: vi.fn(), onfinish: null }; if (!this.classList.contains('reward-path-trace')) animations.push(animation); return animation as unknown as Animation })
  Element.prototype.animate = animate
  const view = render(<Fixture fastMode />)
  try {
    fireEvent.click(screen.getByText('Arrive'))
    expect(document.querySelector('.floating-reward')).toHaveClass('opening')
    expect(animate.mock.calls[0][1]).toMatchObject({ duration: 440 })
    act(() => animations[0].onfinish!())
    act(() => vi.advanceTimersByTime(499))
    expect(document.querySelector('.floating-reward')).toHaveClass('hovering')
    act(() => vi.advanceTimersByTime(1))
    expect(document.querySelector('.floating-reward')).toHaveClass('departing')
    expect(animate.mock.calls.filter((_, index) => { const target = animate.mock.contexts[index]; return target instanceof Element && target.classList.contains('floating-reward') })[1][1]).toMatchObject({ duration: 560, easing: 'cubic-bezier(.42,0,.75,.35)' })
    act(() => animations[1].onfinish!())
    act(() => animations[2].onfinish!())
    expect(document.querySelector('.floating-reward')).toBeNull()
    fireEvent.click(screen.getByText('Score'))
    act(() => animations[3].onfinish!())
    expect(document.querySelector('.floating-reward')).toHaveClass('hovering')
  } finally { view.unmount(); media.mockRestore(); bounds.mockRestore(); Element.prototype.animate = original; vi.useRealTimers() }
})

it('stacks persistent arrivals without pausing incoming rewards and drains them when Fast mode is enabled', () => {
  vi.useFakeTimers()
  const jitter = vi.spyOn(Math, 'random').mockReturnValue(.5)
  const media = vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList)
  const bounds = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 100, 400, 400))
  const animations: { cancel: ReturnType<typeof vi.fn>; onfinish: (() => void) | null }[] = []
  const original = Element.prototype.animate
  Element.prototype.animate = vi.fn(function (this: Element) { const animation = { cancel: vi.fn(), onfinish: null }; if (!this.classList.contains('reward-path-trace')) animations.push(animation); return animation as unknown as Animation })
  const view = render(<Fixture fastMode={false} />)
  try {
    fireEvent.click(screen.getByText('Arrive'))
    act(() => animations[0].onfinish!())
    fireEvent.click(screen.getByText('Another arrival'))
    expect(document.querySelectorAll('.floating-reward')).toHaveLength(1)
    act(() => vi.advanceTimersByTime(509))
    expect(document.querySelectorAll('.floating-reward')).toHaveLength(1)
    act(() => vi.advanceTimersByTime(1))
    expect(document.querySelectorAll('.floating-reward')).toHaveLength(2)
    act(() => animations[1].onfinish!())
    const cards = Array.from(document.querySelectorAll<HTMLElement>('.floating-reward'))
    expect(cards).toHaveLength(2)
    expect(cards.every(card => card.classList.contains('hovering'))).toBe(true)
    expect(cards[0].style.top).not.toBe(cards[1].style.top)
    fireEvent.pointerDown(document.body)
    expect(document.querySelectorAll('.floating-reward.hovering')).toHaveLength(2)
    view.rerender(<Fixture fastMode />)
    expect(document.querySelectorAll('.floating-reward.hovering')).toHaveLength(2)
    act(() => vi.advanceTimersByTime(500))
    expect(document.querySelectorAll('.floating-reward.departing')).toHaveLength(2)
  } finally { view.unmount(); media.mockRestore(); bounds.mockRestore(); Element.prototype.animate = original; jitter.mockRestore(); vi.useRealTimers() }
})

it('automatically dismisses reduced-motion arrivals without running flight animations', () => {
  vi.useFakeTimers()
  const media = vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList)
  const bounds = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 100, 400, 400))
  const view = render(<Fixture fastMode />)
  try {
    fireEvent.click(screen.getByText('Arrive'))
    expect(document.querySelector('.floating-reward')).toBeNull()
    expect(document.querySelector('.reward-path-trace')).toBeNull()
    act(() => vi.advanceTimersByTime(500))
    expect(document.querySelector('.floating-reward')).toBeNull()
  } finally { view.unmount(); media.mockRestore(); bounds.mockRestore(); vi.useRealTimers() }
})

 it('replaces inspected cards and pauses their four-second timeout during pointer or keyboard inspection', () => {
  vi.useFakeTimers()
  const media = vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList)
  const bounds = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 100, 400, 400))
  const view = render(<Fixture fastMode={false} />)
  try {
    fireEvent.click(screen.getByText('Score'))
    const prior = screen.getByRole('dialog', { name: 'XP details' })
    fireEvent.click(screen.getByText('Other score'))
    expect(prior).not.toBeInTheDocument()
    expect(screen.getAllByRole('dialog', { name: 'XP details' })).toHaveLength(1)
    const card = document.querySelector('.floating-reward')!
    fireEvent.pointerEnter(card)
    act(() => vi.advanceTimersByTime(5000))
    expect(card).toBeInTheDocument()
    fireEvent.focus(screen.getByLabelText('Close XP details'))
    fireEvent.pointerLeave(card)
    act(() => vi.advanceTimersByTime(5000))
    expect(card).toBeInTheDocument()
    fireEvent.blur(screen.getByLabelText('Close XP details'), { relatedTarget: document.body })
    act(() => vi.advanceTimersByTime(3999))
    expect(card).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1))
    expect(card).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Score'))
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('dialog', { name: 'XP details' })).toBeNull()
  } finally { view.unmount(); media.mockRestore(); bounds.mockRestore(); vi.useRealTimers() }
})

it('flies mobile Fast mode rewards straight to the meter and fills only on arrival', () => {
  const media = vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: query.includes('max-width'), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList)
  const bounds = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 100, 300, 200))
  const snapshot = structuredClone(skillDemo)
  snapshot.profile.skills.find(skill => skill.skill_id === 'referent')!.xp = 20
  const original = Element.prototype.animate
  const animations: { cancel: ReturnType<typeof vi.fn>; onfinish: (() => void) | null }[] = []
  const animate = vi.fn<Element['animate']>(function (this: Element) {
    const animation = { cancel: vi.fn(), onfinish: null }
    if (this.classList.contains('floating-reward')) animations.push(animation)
    return animation as unknown as Animation
  })
  Element.prototype.animate = animate
  const view = render(<SkillEvidenceContext value={{ snapshot, error: null }}><Fixture fastMode /></SkillEvidenceContext>)
  try {
    fireEvent.click(screen.getByText('Arrive'))
    expect(document.querySelector('.floating-reward')).toHaveClass('departing')
    expect(document.querySelector('.floating-reward.hovering')).toBeNull()
    const flights = animate.mock.calls.filter((_, index) => (animate.mock.contexts[index] as Element).classList.contains('floating-reward'))
    expect(flights).toHaveLength(1)
    expect(flights[0][1]).toMatchObject({ duration: 340 })
    const fill = screen.getByRole('progressbar').firstElementChild as HTMLElement
    expect(parseFloat(fill.style.width)).toBeCloseTo(100 / 3)
    act(() => animations[0].onfinish!())
    expect(parseFloat(fill.style.width)).toBeCloseTo(200 / 3)
  } finally { view.unmount(); media.mockRestore(); bounds.mockRestore(); Element.prototype.animate = original }
})
