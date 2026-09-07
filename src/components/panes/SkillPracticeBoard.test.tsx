import { SkillNavigationProvider } from '../../hooks/useSkillNavigation'
import { useState } from 'react'
import { PracticeContext, DraftAssistanceContext } from './PracticeContext'
import { SkillEvidenceContext } from '../../hooks/useSkillEvidence'
import { ConversationMap } from '../chat/ConversationMap'
// @vitest-environment jsdom
import { fireEvent, render as testingRender, screen, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { SkillPracticeBoard } from './SkillPracticeBoard'
import { skillDemo } from '../../lib/skillDemo'

function Board() {
  const [selected, select] = useState<string | null>(null)
  return <SkillEvidenceContext value={{ snapshot: skillDemo, error: null }}><PracticeContext value={{ chatId: 'chat', selectionVersion: 0, selected, select }}><DraftAssistanceContext value={{ useExample: () => {}, suggestions: { replies: [], frames: [], starters: [] }, suggestionsError: null }}><ConversationMap /><SkillPracticeBoard snapshot={skillDemo} chatId="chat" level="zero" busy={false} /></DraftAssistanceContext></PracticeContext></SkillEvidenceContext>
}

beforeEach(() => localStorage.clear())

vi.mock('./TopicExplanation', () => ({ TopicExplanation: ({ topic }: { topic: string }) => <p>Help: {topic}</p> }))
vi.mock('../../lib/back', () => ({ openOverlay: () => () => {} }))

it('expands stable cards and opens the same explanation by double click or explicit action', () => {
  HTMLDialogElement.prototype.showModal = function (): void { this.open = true }
  HTMLDialogElement.prototype.close = function (): void { this.open = false }
  const view = render(<SkillPracticeBoard snapshot={skillDemo} chatId="chat" level="zero" busy={false} />)
  const card = screen.getByRole('button', { name: /Identify a referent.*XP/ })
  fireEvent.click(card)
  expect(card).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByText(/^Help:/)).toHaveTextContent('Identify a particular person or thing')
  card.focus()
  fireEvent.doubleClick(card)
  expect(screen.getByRole('dialog')).toHaveAccessibleName('Identify a referent')
  fireEvent.click(screen.getByRole('dialog'), { clientX: -1, clientY: -1 })
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(card).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: 'Explanation & reviewed replies ↗' }))
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: false, cancelable: true }))
  expect(screen.queryByRole('dialog')).toBeNull()
  const labels = view.container.querySelectorAll('.practice-card-toggle')
  const before = Array.from(labels, item => item.getAttribute('aria-controls'))
  view.rerender(<SkillPracticeBoard snapshot={{ ...skillDemo, profile: { ...skillDemo.profile, xp: 100 } }} chatId="chat" level="zero" busy={false} />)
  expect(Array.from(view.container.querySelectorAll('.practice-card-toggle'), item => item.getAttribute('aria-controls'))).toEqual(before)
})

it('browses all seven domains without changing saved practice focus', () => {
  render(<Board />)
  const branch = within(screen.getByLabelText('Conversation skill map')).getByRole('button', { name: /Time & event structure/ })
  fireEvent.click(branch)
  expect(branch).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: /Refer to past events.*XP/ })).toHaveAttribute('aria-expanded', 'true')
  expect(skillDemo.profile.active_focus).toBe('referent')
  fireEvent.click(screen.getByRole('button', { name: 'Collapse skill map' }))
  expect(within(screen.getByLabelText('Conversation skill map')).queryByRole('button', { name: /Time & event structure/ })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Expand skill map' }))
  expect(within(screen.getByLabelText('Conversation skill map')).getByRole('button', { name: /Time & event structure/ })).toHaveAttribute('aria-pressed', 'true')
})

 it('links all seven cards to their map arms and remembers grid layout without changing selection', () => {
  const view = render(<Board />)
  fireEvent.click(screen.getByLabelText('Card display options'))
  fireEvent.click(screen.getByRole('button', { name: 'All areas' }))
  expect(view.container.querySelectorAll('.practice-card')).toHaveLength(7)
  const card = screen.getByRole('button', { name: /Refer to past events.*XP/ })
  fireEvent.click(card)
  expect(card).toHaveAttribute('aria-pressed', 'true')
  expect(card.closest('article')).toHaveClass('is-selected')
  expect(view.container.querySelector('.practice-card')).toBe(card.closest('article'))
  const map = within(screen.getByLabelText('Conversation skill map'))
  expect(map.getByRole('button', { name: /Time & event structure/ })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(map.getByRole('button', { name: /Entities & reference/ }))
  expect(card).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByRole('button', { name: /Identify a referent.*XP/ })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'Grid' }))
  expect(view.container.querySelector('.practice-cards')).toHaveClass('grid')
  expect(skillDemo.profile.active_focus).toBe('referent')
  view.unmount()
  render(<Board />)
  fireEvent.click(screen.getByLabelText('Card display options'))
  expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true')
})

function render(ui: React.ReactNode) { return testingRender(ui, { wrapper: SkillNavigationProvider }) }
