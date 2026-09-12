import { create } from 'zustand'

/// Which skill the learner is looking at, and a request to show one on the map.
///
/// Deliberately separate from the shell's navigation store: which page and which
/// dialog are open is unrelated to which skill is selected, and one store would
/// re-render every dialog on a skill click.

export interface SkillLocation {
  target: string
  skillId: string
}

export interface SkillNavigationState {
  /// Bumped on every selection, so a consumer can tell two identical-looking
  /// selections apart.
  sequence: number
  selected: SkillLocation | null
  mapRequest: { location: SkillLocation; sequence: number } | null
}

export type SkillNavigationAction =
  | { type: 'select'; location: SkillLocation }
  | { type: 'explore'; location: SkillLocation }

/// Pure, so the store applies it and a test can drive it on its own.
export function skillNavigationReducer(state: SkillNavigationState, action: SkillNavigationAction): SkillNavigationState {
  return { sequence: state.sequence + 1, selected: action.location, mapRequest: action.type === 'explore' ? { location: action.location, sequence: (state.mapRequest?.sequence ?? 0) + 1 } : state.mapRequest }
}

interface SkillNavigationStore extends SkillNavigationState {
  select: (location: SkillLocation) => void
  explore: (location: SkillLocation) => void
}

const initialState: SkillNavigationState = { sequence: 0, selected: null, mapRequest: null }

export const useSkillNavigationStore = create<SkillNavigationStore>((set) => ({
  ...initialState,
  select: (location) => set((state) => skillNavigationReducer(state, { type: 'select', location })),
  explore: (location) => set((state) => skillNavigationReducer(state, { type: 'explore', location })),
}))
