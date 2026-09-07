// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { useSkillEvidence } from './useSkillEvidence'
import { skillDemo } from '../lib/skillDemo'
import type { SkillSnapshot } from '../lib/skills'
const backend = vi.hoisted(() => ({ get: vi.fn(), subscribe: vi.fn(), save: vi.fn() }))
vi.mock('../lib/tauri', () => ({ isTauri: true }))
vi.mock('../lib/skills', () => ({ getSkillEvidence: backend.get, subscribeSkillEvidence: backend.subscribe, saveSkillProfile: backend.save }))
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
