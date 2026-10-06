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

const focusHeading = () => document.querySelector('.skill-levels-focus h3')?.textContent

describe('SkillLevelsPanel', () => {
  it('names every arm on the chart and shows a pressed arm right under it', () => {
    render(<SkillLevelsPanel snapshot={snapshotWithPoints([9, 6, 11, 5, 7, 5, 13, 8])} conversation={null} onInspect={null} />)
    expect(screen.getByText('Skill level 4')).toBeTruthy()
    expect(document.querySelectorAll('.skill-radar-label')).toHaveLength(8)
    expect(screen.getByText('Lv 5 goal')).toBeTruthy()
    expect(focusHeading()).toBe('Managing conversation')
    fireEvent.click(screen.getByRole('button', { name: /^Possibilities and constraints: skill level 4/ }))
    expect(focusHeading()).toBe('Possibilities and constraints')
    expect(screen.getByText('3 more points for level 5')).toBeTruthy()
  })
  it('lists every skill holding the next level back and every skill already ready', () => {
    render(<SkillLevelsPanel snapshot={snapshotWithPoints([9, 6, 11, 5, 7, 5, 13, 8])} conversation={null} onInspect={null} />)
    const next = screen.getByRole('heading', { name: 'To reach level 5' }).parentElement!
    expect(within(next).getAllByRole('button')).toHaveLength(4)
    const ready = screen.getByRole('heading', { name: 'Ready for level 5' }).parentElement!
    expect(within(ready).getAllByRole('button')).toHaveLength(4)
    fireEvent.click(within(next).getByRole('button', { name: /Feelings and viewpoints/ }))
    expect(focusHeading()).toBe('Feelings and viewpoints')
  })
  it('opens more about the focused skill when the owner allows it', () => {
    const inspect = vi.fn()
    render(<SkillLevelsPanel snapshot={snapshotWithPoints([1, 1, 1, 1, 1, 1, 1, 1])} conversation={null} onInspect={inspect} />)
    const next = screen.getByRole('heading', { name: 'To reach level 2' }).parentElement!
    fireEvent.click(within(next).getByRole('button', { name: /Possibilities and constraints/ }))
    fireEvent.click(screen.getByRole('button', { name: 'More about this skill' }))
    expect(inspect).toHaveBeenCalledWith('possibilities_constraints')
  })
  it('tells a new learner how to reach level 1', () => {
    render(<SkillLevelsPanel snapshot={skillDemo} conversation={null} onInspect={null} />)
    expect(screen.getByText('Get a skill point in each skill to reach level 1.')).toBeTruthy()
  })
  it('keeps one selected skill that hover never changes, marked on the chart, the lists and the card', () => {
    render(<SkillLevelsPanel snapshot={snapshotWithPoints([9, 6, 11, 5, 7, 5, 13, 8])} conversation={null} onInspect={null} />)
    const start = focusHeading()
    const ready = screen.getByRole('heading', { name: 'Ready for level 5' }).parentElement!
    const chip = within(ready).getAllByRole('button')[0]
    fireEvent.pointerEnter(chip)
    expect(focusHeading()).toBe(start)
    fireEvent.click(chip)
    const chosen = focusHeading()
    expect(chosen).not.toBe(start)
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: new RegExp(`^${chosen}: skill level`) })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(chip)
    expect(focusHeading()).toBe(chosen)
  })
})
