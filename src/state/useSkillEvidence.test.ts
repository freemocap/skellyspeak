// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { selectSkillSnapshot, useLoadSkillEvidence, useSkillEvidence } from './useSkillEvidence'
import { useSettingsStore } from './settings'
import { useSkillEvidenceStore } from './skill-evidence'
import { skillDemo } from '../domain/skills/skillDemo'
import type { Settings } from '../types'
import type { SkillSnapshot } from '../domain/skills/skills'

const backend = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }))
vi.mock('../platform/ipc/tauri', () => ({ isTauri: true, languageFor: () => null }))
vi.mock('../platform/skill-evidence', () => ({ getSkillEvidence: backend.get, saveSkillProfile: backend.save }))

/// Both hooks, composed the way the app composes them: the shell keeps evidence
/// read and the surfaces read it. The read takes its language from the settings
/// store, and test setup resets every store between tests, so it is seeded per
/// test rather than once at module load.
const mount = () => renderHook(() => { useLoadSkillEvidence(); return useSkillEvidence() })
function seed(language: string, revision = 0) {
  useSettingsStore.setState({ settings: { target_language: language } as Settings, revision })
}

beforeEach(() => {
  backend.get.mockReset()
  seed(skillDemo.target)
})

it('reads once for a language and a settings revision, however many surfaces ask', async () => {
  backend.get.mockResolvedValue(skillDemo)
  const views = [mount(), mount(), mount()]
  await waitFor(() => expect(views[2].result.current.snapshot).toEqual(skillDemo))
  expect(backend.get).toHaveBeenCalledTimes(1)
  expect(backend.get).toHaveBeenCalledWith(skillDemo.target)
})

it('coalesces a burst of reloads into one trailing read', async () => {
  let resolve: (value: SkillSnapshot) => void = () => { throw new Error('No request') }
  backend.get.mockImplementationOnce(() => new Promise<SkillSnapshot>(done => { resolve = done })).mockResolvedValue(skillDemo)
  const view = mount()
  await waitFor(() => expect(backend.get).toHaveBeenCalledTimes(1))
  // The conversation advancing is the signal; three of them while a read is in
  // flight must become one more read, not three.
  act(() => {
    useSkillEvidenceStore.getState().reload()
    useSkillEvidenceStore.getState().reload()
    useSkillEvidenceStore.getState().reload()
  })
  expect(backend.get).toHaveBeenCalledTimes(1)
  await act(async () => { resolve(skillDemo) })
  await waitFor(() => expect(backend.get).toHaveBeenCalledTimes(2))
  expect(view.result.current.snapshot).toEqual(skillDemo)
})

it('hides evidence read under settings that no longer apply', async () => {
  backend.get.mockResolvedValueOnce(skillDemo)
  const view = mount()
  await waitFor(() => expect(view.result.current.snapshot).toEqual(skillDemo))
  // The next revision's read never answers, so the only snapshot the store holds
  // is the one read under the revision that no longer applies.
  backend.get.mockImplementationOnce(() => new Promise<SkillSnapshot>(() => {}))
  act(() => { seed(skillDemo.target, 1) })
  expect(view.result.current.snapshot).toBeNull()
  expect(backend.get).toHaveBeenCalledTimes(2)
})

it('ignores a late answer for the language that was left', async () => {
  let finishOld: (value: SkillSnapshot) => void = () => { throw new Error('Request not started') }
  const arabic = { ...skillDemo, target: 'ar' }
  backend.get.mockImplementationOnce(() => new Promise<SkillSnapshot>(resolve => { finishOld = resolve })).mockResolvedValueOnce(arabic)
  const view = mount()
  await waitFor(() => expect(backend.get).toHaveBeenCalledTimes(1))
  act(() => { seed('ar', 1) })
  await waitFor(() => expect(view.result.current.snapshot?.target).toBe('ar'))
  await act(async () => { finishOld(skillDemo) })
  expect(view.result.current.snapshot?.target).toBe('ar')
})

it('shows a snapshot only for the language and settings revision it was read for', () => {
  const state = { ...useSkillEvidenceStore.getState(), snapshot: skillDemo, scope: 3 }
  expect(selectSkillSnapshot(state, skillDemo.target, 3)).toEqual(skillDemo)
  expect(selectSkillSnapshot(state, 'fr', 3)).toBeNull()
  expect(selectSkillSnapshot(state, skillDemo.target, 4)).toBeNull()
  expect(selectSkillSnapshot(state, undefined, 3)).toBeNull()
})
