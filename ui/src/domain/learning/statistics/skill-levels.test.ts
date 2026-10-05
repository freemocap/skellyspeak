import { describe, expect, it } from 'vitest'
import { bandPosition, conversationSkillPoints, holdingBack, languageSkillLevels } from './skill-levels'
import { skillDemo } from '../catalog/skillDemo'
import { unreportedInput, type SkillSnapshot } from '../evidence/skills'
import { withFixtureLevels } from '../../../../tests/fixtures/skill-levels'

const ids = skillDemo.catalog.filter(node => node.kind === 'skill').map(node => node.id)

function learner(points: number[], chatFor: (skill: number, n: number) => string = () => 'earlier'): SkillSnapshot {
  const snapshot = structuredClone(skillDemo)
  ids.forEach((id, index) => {
    for (let n = 0; n < points[index]; n++) {
      const attempt = `${id}-${n}`
      snapshot.records.push({ attempt_id: attempt, session_id: 's', turn_id: n, message_id: n, replaces_message_id: null, construct_registry_hash: snapshot.construct_registry_hash, mapping_error: null, support_step: null, chat_id: chatFor(index, n), learner_id: 'demo', target: snapshot.target, native: 'english', source: 'x', input: unreportedInput(), at_secs: 0, model: 'm', provider_mode: 'hosted', catalog_version: snapshot.catalog_version, prompt_version: 'p', status: 'complete', error: null, assessment: null })
      snapshot.profile.credits.push({ attempt_id: attempt, skill_id: id, xp: 1 })
    }
  })
  return withFixtureLevels(snapshot)
}

describe('language skill levels', () => {
  it('reads the native projection in catalog order and derives presentation values', () => {
    const levels = languageSkillLevels(learner([9, 6, 11, 5, 7, 5, 13, 8]))
    expect(levels.level).toBe(4)
    expect(levels.target).toBe(8)
    expect(levels.bands).toEqual([1, 2, 3, 5, 8])
    expect(levels.ready).toBe(4)
    expect(levels.skills[1]).toMatchObject({ points: 6, level: 4, currentThreshold: 5, nextThreshold: 8 })
    expect(levels.skills[1].position).toBeCloseTo(4 + 1 / 3)
  })
  it('names what holds the next level back, largest gap first', () => {
    const behind = holdingBack(languageSkillLevels(learner([9, 6, 11, 5, 7, 5, 13, 8])))
    expect(behind[0].needed).toBe(3)
    expect(behind.map(item => item.needed)).toEqual([...behind.map(item => item.needed)].sort((a, b) => b - a))
    expect(behind.every(item => item.skill.points < 8)).toBe(true)
  })
  it('refuses a scope without levels and a projection out of catalog order', () => {
    const scoped = learner(ids.map(() => 1))
    expect(() => languageSkillLevels({ ...scoped, profile: { ...scoped.profile, levels: null } })).toThrow('only the language scope')
    const swapped = structuredClone(scoped)
    swapped.profile.levels!.skills.reverse()
    expect(() => languageSkillLevels(swapped)).toThrow('catalog order')
  })
  it('rejects an empty band and points below the current threshold', () => {
    expect(() => bandPosition(2, 2, 2, 2)).toThrow('empty')
    expect(() => bandPosition(3, 2, 3, 5)).toThrow('below')
  })
})

describe('conversation skill points', () => {
  it('counts one conversation\'s credits per skill without any level', () => {
    const snapshot = learner(ids.map(() => 3), (skill, n) => skill < 2 && n === 0 ? 'chat' : 'earlier')
    const points = conversationSkillPoints(snapshot, 'chat')
    expect(points.total).toBe(2)
    expect(points.skills.slice(0, 3).map(skill => skill.points)).toEqual([1, 1, 0])
    expect('level' in points).toBe(false)
  })
})
