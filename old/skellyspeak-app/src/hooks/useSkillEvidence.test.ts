// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useSkillEvidence } from './useSkillEvidence'
import { skillDemo } from '../lib/skillDemo'
import type { SkillSnapshot } from '../lib/skills'
const backend = vi.hoisted(() => ({ get: vi.fn(), subscribe: vi.fn(), save: vi.fn() }))
vi.mock('../lib/tauri', () => ({ isTauri: true }))
vi.mock('../lib/skills', () => ({ getSkillEvidence: backend.get, subscribeSkillEvidence: backend.subscribe, saveLanguageProfile: backend.save }))
it('coalesces event bursts into one trailing refresh and masks prior scope data', async () => {
  let refresh = (): void => { throw new Error('Not subscribed') }
  backend.subscribe.mockImplementation(async (callback: () => void) => { refresh = callback; return () => {} })
  let resolve: (value: SkillSnapshot) => void = () => { throw new Error('No request') }
  backend.get.mockImplementationOnce(() => new Promise<SkillSnapshot>(done => { resolve = done })).mockResolvedValue(skillDemo)
  const view = renderHook(({ version }) => useSkillEvidence(true, version), { initialProps: { version: 0 } })
  await waitFor(() => expect(backend.get).toHaveBeenCalledTimes(1))
  act(() => { refresh(); refresh(); refresh() })
  expect(backend.get).toHaveBeenCalledTimes(1)
  await act(async () => { resolve(skillDemo) })
  await waitFor(() => expect(backend.get).toHaveBeenCalledTimes(2))
  expect(view.result.current.snapshot).toEqual(skillDemo)
  backend.get.mockImplementationOnce(() => new Promise<SkillSnapshot>(() => {}))
  view.rerender({ version: 1 })
  expect(view.result.current.snapshot).toBeNull()
})

it('ignores a late snapshot from the language that was left', async () => {
  vi.resetAllMocks()
  backend.subscribe.mockResolvedValue(() => {})
  let finishOld: (value: SkillSnapshot) => void = () => { throw new Error('Request not started') }
  const arabic = { ...skillDemo, target: 'ar' }
  backend.get.mockImplementationOnce(() => new Promise<SkillSnapshot>(resolve => { finishOld = resolve })).mockResolvedValueOnce(arabic)
  const view = renderHook(({ version }) => useSkillEvidence(true, version), { initialProps: { version: 0 } })
  await waitFor(() => expect(backend.get).toHaveBeenCalledTimes(1))
  view.rerender({ version: 1 })
  await waitFor(() => expect(view.result.current.snapshot?.target).toBe('ar'))
  await act(async () => { finishOld(skillDemo) })
  expect(view.result.current.snapshot?.target).toBe('ar')
})

it('applies confirmed saves and prevents an in-flight refresh from reducing the profile revision', async () => {
  vi.resetAllMocks()
  backend.subscribe.mockResolvedValue(() => {})
  backend.get.mockResolvedValue(skillDemo)
  const view = renderHook(() => useSkillEvidence(true, 0))
  await waitFor(() => expect(view.result.current.snapshot).toEqual(skillDemo))
  const saved = { ...skillDemo, profile: { ...skillDemo.profile, choices: { ...skillDemo.profile.choices, revision: 1, focus: 'referent' } } }
  backend.save.mockResolvedValue(saved)
  await act(async () => { await view.result.current.save({ ...skillDemo.profile.choices, focus: 'referent' }) })
  await waitFor(() => expect(backend.get).toHaveBeenCalledTimes(2))
  expect(view.result.current.snapshot?.profile.choices).toEqual(saved.profile.choices)
})

it('rejects simultaneous saves and ignores save results after a scope change', async () => {
  vi.resetAllMocks()
  backend.subscribe.mockResolvedValue(() => {})
  backend.get.mockResolvedValue(skillDemo)
  let finish: (value: SkillSnapshot) => void = () => { throw new Error('Save not started') }
  backend.save.mockImplementation(() => new Promise<SkillSnapshot>(resolve => { finish = resolve }))
  const view = renderHook(({ scope }) => useSkillEvidence(true, scope), { initialProps: { scope: 0 } })
  await waitFor(() => expect(view.result.current.snapshot).toEqual(skillDemo))
  let pending: Promise<void> = Promise.resolve()
  act(() => { pending = view.result.current.save(skillDemo.profile.choices) })
  await expect(view.result.current.save(skillDemo.profile.choices)).rejects.toThrow('already in progress')
  const arabic = { ...skillDemo, target: 'ar', profile: { ...skillDemo.profile, choices: { ...skillDemo.profile.choices, target: 'ar' } } }
  backend.get.mockResolvedValue(arabic)
  view.rerender({ scope: 1 })
  await waitFor(() => expect(view.result.current.snapshot?.target).toBe('ar'))
  await act(async () => { finish(skillDemo); await pending })
  expect(view.result.current.snapshot?.target).toBe('ar')
  expect(view.result.current.saving).toBe(false)
})
