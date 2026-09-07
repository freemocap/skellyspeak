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
vi.mock('../../lib/message-evidence', () => ({ createMessageEvidenceSelector: () => () => items }))
function Triggers() {
  const controller = useContext(RewardInspectionContext)!
  return <button onClick={() => controller.open(items as MessageEvidence[], 1, 'this cup')}>Score</button>
}
function Fixture() {
  const workspace = useRef<HTMLDivElement>(null)
  return <SkillNavigationProvider><RewardPresentationProvider workspace={workspace} chatId="chat" active={true}><div ref={workspace}><div className="stream"><Triggers /></div><div data-reward-domain="reference" /></div></RewardPresentationProvider></SkillNavigationProvider>
}
it('grows, holds, and departs on dismissal before flashing the destination', () => {
  const media = vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList)
  const bounds = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 100, 400, 400))
  const animations: { cancel: ReturnType<typeof vi.fn>; onfinish: (() => void) | null }[] = []
  const original = Element.prototype.animate
  Element.prototype.animate = vi.fn(() => { const animation = { cancel: vi.fn(), onfinish: null }; animations.push(animation); return animation as unknown as Animation })
  const view = render(<Fixture />)
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
