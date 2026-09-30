// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { SkillLevelsPanel } from './SkillLevelsPanel'
import { skillDemo } from '../../../domain/learning/catalog/skillDemo'

function snapshotWithPoints(points: number[]) {
  const snapshot = structuredClone(skillDemo)
  snapshot.catalog.filter(node => node.kind === 'skill').forEach((skill, index) => {
    for (let n = 0; n < points[index]; n++) snapshot.profile.credits.push({ attempt_id: `${skill.id}-${n}`, skill_id: skill.id, xp: 1 })
  })
  return snapshot
}

describe('SkillLevelsPanel', () => {
  it('shows the weakest skill as the level and filters the list to a pressed arm', () => {
    render(<SkillLevelsPanel snapshot={snapshotWithPoints([9, 6, 11, 5, 7, 5, 13, 8, 6, 9, 5, 6])} conversation={null} />)
    expect(screen.getByText('Skill level 4')).toBeTruthy()
    const list = screen.getByRole('list')
    expect(within(list).getAllByRole('button')).toHaveLength(12)
    fireEvent.click(screen.getByRole('button', { name: /^Make and respond to requests: skill level 4/ }))
    expect(within(list).getAllByRole('button')).toHaveLength(1)
    expect(screen.getByText('Showing Make and respond to requests')).toBeTruthy()
    fireEvent.click(screen.getByText('Show all'))
    expect(within(list).getAllByRole('button')).toHaveLength(12)
  })
  it('tells a new learner how to reach level 1', () => {
    render(<SkillLevelsPanel snapshot={skillDemo} conversation={null} />)
    expect(screen.getByText('Get a skill point in each skill to reach level 1.')).toBeTruthy()
  })
})
