import { expect, it } from 'vitest'
import { skillNavigationReducer } from './skill-navigation'
it('preserves selected identity across exploration and distinguishes repeated selections', () => {
  const location = { target: 'es-ES', skillId: 'reason' }
  const first = skillNavigationReducer({ sequence: 0, selected: null, mapRequest: null }, { type: 'select', location })
  expect(first.selected).toEqual(location)
  expect(first.mapRequest).toBeNull()
  const explored = skillNavigationReducer(first, { type: 'explore', location })
  expect(explored.mapRequest?.location).toEqual(location)
  expect(skillNavigationReducer(explored, { type: 'select', location }).sequence).toBe(3)
})
