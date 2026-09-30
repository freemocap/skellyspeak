import { describe, expect, it } from 'vitest'
import { levelFor, levelPosition, levelThreshold, skillLevels } from './skill-levels'
import { skillDemo } from '../catalog/skillDemo'

describe('skill levels', () => {
  it('uses Fibonacci thresholds without the repeated 1', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(levelThreshold)).toEqual([0, 1, 2, 3, 5, 8, 13, 21, 34])
  })
  it('maps points to the highest reached level', () => {
    expect([0, 1, 2, 3, 4, 5, 7, 8, 12, 13].map(levelFor)).toEqual([0, 1, 2, 3, 3, 4, 4, 5, 5, 6])
  })
  it('interpolates inside a band', () => {
    expect(levelPosition(0)).toBe(0)
    expect(levelPosition(5)).toBe(4)
    expect(levelPosition(6)).toBeCloseTo(4 + 1 / 3)
  })
  it('rejects fractional and negative inputs', () => {
    expect(() => levelFor(-1)).toThrow()
    expect(() => levelThreshold(1.5)).toThrow()
  })
  it('counts credited messages per skill and takes the weakest skill as the level', () => {
    const snapshot = structuredClone(skillDemo)
    const skills = snapshot.catalog.filter(node => node.kind === 'skill')
    skills.forEach((skill, index) => {
      for (let n = 0; n < (index === 0 ? 1 : 3); n++) snapshot.profile.credits.push({ attempt_id: `${skill.id}-${n}`, skill_id: skill.id, xp: 1 })
    })
    const levels = skillLevels(snapshot)
    expect(levels.level).toBe(1)
    expect(levels.target).toBe(2)
    expect(levels.ready).toBe(skills.length - 1)
    expect(levels.skills[0]).toMatchObject({ points: 1, level: 1, nextThreshold: 2 })
    expect(levels.skills[1]).toMatchObject({ points: 3, level: 3, nextThreshold: 5 })
  })
  it('fails on a credit for an unknown skill', () => {
    const snapshot = structuredClone(skillDemo)
    snapshot.profile.credits.push({ attempt_id: 'a', skill_id: 'not_a_skill', xp: 1 })
    expect(() => skillLevels(snapshot)).toThrow('outside the catalog')
  })
})
