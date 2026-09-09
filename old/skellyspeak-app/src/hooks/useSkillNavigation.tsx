import { createContext, useContext, useReducer, useCallback, type ReactNode } from 'react'

export interface SkillLocation { target: string; skillId: string }
interface NavigationState { sequence: number; selected: SkillLocation | null; mapRequest: { location: SkillLocation; sequence: number } | null }
type Action = { type: 'select'; location: SkillLocation } | { type: 'explore'; location: SkillLocation }
export function skillNavigationReducer(state: NavigationState, action: Action): NavigationState {
  return { sequence: state.sequence + 1, selected: action.location, mapRequest: action.type === 'explore' ? { location: action.location, sequence: (state.mapRequest?.sequence ?? 0) + 1 } : state.mapRequest }
}
const NavigationContext = createContext<{ state: NavigationState; select: (location: SkillLocation) => void; explore: (location: SkillLocation) => void } | null>(null)
export function SkillNavigationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(skillNavigationReducer, { sequence: 0, selected: null, mapRequest: null })
  const select = useCallback((location: SkillLocation) => dispatch({ type: 'select', location }), [])
  const explore = useCallback((location: SkillLocation) => dispatch({ type: 'explore', location }), [])
  return <NavigationContext value={{ state, select, explore }}>{children}</NavigationContext>
}
export function useSkillNavigation() {
  const value = useContext(NavigationContext)
  if (!value) throw new Error('Skill navigation requires its provider')
  return value
}
