// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { SkillLevelsPanel } from './SkillLevelsPanel'
import { skillDemo } from '../../domain/learning/catalog/skillDemo'
import { withFixtureLevels } from '../../../tests/fixtures/skill-levels'

function snapshotWithPoints(points: number[]) {
  const snapshot = structuredClone(skillDemo)
  snapshot.catalog.filter(node => node.kind === 'skill').forEach((skill, index) => {
    for (let n = 0; n < points[index]; n++) snapshot.profile.credits.push({ attempt_id: `${skill.id}-${n}`, skill_id: skill.id, xp: 1 })
  })
  return withFixtureLevels(snapshot)
}

describe('SkillLevelsPanel', () => {
  it('shows the weakest skill as the level and filters the list to a pressed arm', () => {
    render(<SkillLevelsPanel snapshot={snapshotWithPoints([9, 6, 11, 5, 7, 5, 13, 8, 6, 9, 5, 6])} conversation={null} onInspect={null} />)
    expect(screen.getByText('Skill level 4')).toBeTruthy()
    const rows = () => document.querySelectorAll('.skill-levels-row')
    expect(rows()).toHaveLength(12)
    fireEvent.click(screen.getByRole('button', { name: /^Make and respond to requests: skill level 4/ }))
    expect(rows()).toHaveLength(1)
    expect(screen.getByText('Showing Make and respond to requests')).toBeTruthy()
    fireEvent.click(screen.getByText('Show all'))
    expect(rows()).toHaveLength(12)
  })
  it('names the skills holding the next level back and pins one when pressed', () => {
    render(<SkillLevelsPanel snapshot={snapshotWithPoints([9, 6, 11, 5, 7, 5, 13, 8, 6, 9, 5, 6])} conversation={null} onInspect={null} />)
    const next = screen.getByRole('heading', { name: 'To reach level 5' }).parentElement!
    expect(within(next).getAllByRole('button')).toHaveLength(3)
    expect(within(next).getByText('4 more skills')).toBeTruthy()
    fireEvent.click(within(next).getByRole('button', { name: /Describe present situations/ }))
    expect(document.querySelectorAll('.skill-levels-row')).toHaveLength(1)
  })
  it('opens evidence for the focused skill when the owner allows it', () => {
    const inspect = vi.fn()
    render(<SkillLevelsPanel snapshot={snapshotWithPoints([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1])} conversation={null} onInspect={inspect} />)
    fireEvent.click(document.querySelector('[data-reward-skill="quantity"]')!)
    fireEvent.click(screen.getByRole('button', { name: 'See the evidence' }))
    expect(inspect).toHaveBeenCalledWith('quantity')
  })
  it('tells a new learner how to reach level 1', () => {
    render(<SkillLevelsPanel snapshot={skillDemo} conversation={null} onInspect={null} />)
    expect(screen.getByText('Get a skill point in each skill to reach level 1.')).toBeTruthy()
  })
})
