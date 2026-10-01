// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { groupLevelEvents, useSkillLevelEventQueue, useSkillLevelEventStore } from './skill-level-events'
import { skillDemo } from '../../domain/learning/catalog/skillDemo'
import type { SkillLevelEvent } from '../../generated/contracts'
import type { SkillSnapshot } from '../../domain/learning/evidence/skills'

const ipc = vi.hoisted(() => ({ initialize: vi.fn(), claim: vi.fn() }))
const faults = vi.hoisted(() => ({ report: vi.fn() }))
vi.mock('../../platform/ipc/skill-levels', () => ({ initializeSkillLevelEvents: ipc.initialize, claimSkillLevelEvents: ipc.claim }))
vi.mock('../../platform/diagnostics/faults', () => ({ reportFault: faults.report }))

const skill = (sequence: number, skillId: string, toLevel: number): SkillLevelEvent => ({ id: `s${sequence}`, sequence, kind: 'skill_level', skillId, fromLevel: toLevel - 1, toLevel })
const language = (sequence: number, toLevel: number): SkillLevelEvent => ({ id: `l${sequence}`, sequence, kind: 'language_level', fromLevel: toLevel - 1, toLevel })

function snapshotWith(pending: SkillLevelEvent[]): SkillSnapshot {
  return { ...structuredClone(skillDemo), profile: { ...structuredClone(skillDemo.profile), pendingLevelEvents: pending } }
}

beforeEach(() => {
  ipc.initialize.mockReset(); ipc.claim.mockReset(); faults.report.mockReset()
  useSkillLevelEventStore.setState({ initialized: null, working: false, showing: null })
})

describe('grouping', () => {
  it('collects skill steps until the language step they complete', () => {
    const groups = groupLevelEvents([skill(1, 'quantity', 1), skill(2, 'requests', 1), language(3, 1), skill(4, 'quantity', 2)])
    expect(groups.map(group => group.kind)).toEqual(['skills', 'language', 'skills'])
    expect(groups[0]).toMatchObject({ events: [{ id: 's1' }, { id: 's2' }] })
  })
  it('refuses a skill step without a skill', () => {
    expect(() => groupLevelEvents([{ id: 'x', sequence: 1, kind: 'skill_level', fromLevel: 0, toLevel: 1 }])).toThrow('no skill')
  })
})

describe('the language-level queue', () => {
  it.each(['language switch', 'settings refresh'])('leaves later milestones unclaimed across a %s', async interruption => {
    const events = [skill(1, 'quantity', 1), language(2, 1), skill(3, 'quantity', 2)]
    const claimed = new Set<string>()
    ipc.initialize.mockImplementation((target: string) => Promise.resolve(target === skillDemo.target ? events.filter(event => !claimed.has(event.id)) : []))
    ipc.claim.mockImplementation((_target: string, ids: string[]) => {
      const accepted = events.filter(event => ids.includes(event.id) && !claimed.has(event.id))
      accepted.forEach(event => claimed.add(event.id))
      return Promise.resolve(accepted)
    })
    const reload = vi.fn()
    const view = renderHook(({ snapshot }: { snapshot: SkillSnapshot | null }) => useSkillLevelEventQueue(snapshot, reload), { initialProps: { snapshot: snapshotWith(events) as SkillSnapshot | null } })
    await waitFor(() => expect(useSkillLevelEventStore.getState().showing?.kind).toBe('skills'))
    expect([...claimed]).toEqual(['s1'])
    view.rerender({ snapshot: interruption === 'settings refresh' ? null : { ...snapshotWith([]), target: 'arabic' } })
    await waitFor(() => expect(useSkillLevelEventStore.getState().working).toBe(false))
    view.rerender({ snapshot: snapshotWith(events.filter(event => !claimed.has(event.id))) })
    await waitFor(() => expect(useSkillLevelEventStore.getState().showing).toMatchObject({ kind: 'language', event: { id: 'l2' } }))
    expect([...claimed]).toEqual(['s1', 'l2'])
    expect(claimed.has('s3')).toBe(false)
  })
  it('retains the current presentation when the window hides during its claim', async () => {
    const events = [skill(1, 'quantity', 1), language(2, 1)]
    let finish!: (events: SkillLevelEvent[]) => void
    ipc.initialize.mockResolvedValue(events)
    ipc.claim.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const reload = vi.fn()
    const view = renderHook(() => useSkillLevelEventQueue(snapshotWith(events), reload))
    await waitFor(() => expect(ipc.claim).toHaveBeenCalledWith(skillDemo.target, ['s1']))
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    try {
      await act(async () => { finish([events[0]]) })
      expect(useSkillLevelEventStore.getState().showing).toMatchObject({ kind: 'skills', events: [{ id: 's1' }] })
      expect(ipc.claim).toHaveBeenCalledOnce()
    } finally { view.unmount(); visibility.mockRestore() }
  })
  it('does not claim an initialization response after switching languages', async () => {
    let finish!: (events: SkillLevelEvent[]) => void
    ipc.initialize.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValue([])
    const reload = vi.fn()
    const first = snapshotWith([])
    const view = renderHook(({ snapshot }) => useSkillLevelEventQueue(snapshot, reload), { initialProps: { snapshot: first } })
    view.rerender({ snapshot: { ...snapshotWith([]), target: 'arabic' } })
    await act(async () => { finish([skill(1, 'quantity', 1)]) })
    await waitFor(() => expect(ipc.initialize).toHaveBeenCalledWith('arabic'))
    expect(ipc.claim).not.toHaveBeenCalled()
    expect(useSkillLevelEventStore.getState().showing).toBeNull()
  })
  it('does not claim when initialization finishes in a hidden window', async () => {
    let finish!: (events: SkillLevelEvent[]) => void
    ipc.initialize.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const view = renderHook(() => useSkillLevelEventQueue(snapshotWith([]), vi.fn()))
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    await act(async () => { finish([skill(1, 'quantity', 1)]) })
    expect(ipc.claim).not.toHaveBeenCalled()
    view.unmount()
    visibility.mockRestore()
  })
  it('does not initialize or claim with reward effects disabled', () => {
    renderHook(() => useSkillLevelEventQueue(snapshotWith([skill(1, 'quantity', 1)]), vi.fn(), false))
    expect(ipc.initialize).not.toHaveBeenCalled()
    expect(ipc.claim).not.toHaveBeenCalled()
  })
  it('discards a delayed claim response after switching language', async () => {
    let finish!: (events: SkillLevelEvent[]) => void
    const events = [skill(1, 'quantity', 1)]
    ipc.initialize.mockResolvedValueOnce(events).mockResolvedValue([])
    ipc.claim.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const view = renderHook(({ snapshot }) => useSkillLevelEventQueue(snapshot, vi.fn()), { initialProps: { snapshot: snapshotWith([]) } })
    await waitFor(() => expect(ipc.claim).toHaveBeenCalledOnce())
    view.rerender({ snapshot: { ...snapshotWith([]), target: 'arabic' } })
    await act(async () => { finish(events) })
    expect(useSkillLevelEventStore.getState().showing).toBeNull()
  })
  it('bounds claims to 100 and loads the next batch after presentation', async () => {
    const events = Array.from({ length: 101 }, (_, n) => skill(n + 1, 'quantity', n + 1))
    ipc.initialize.mockResolvedValue(events)
    ipc.claim.mockImplementation((_target: string, ids: string[]) => Promise.resolve(events.filter(event => ids.includes(event.id))))
    const reload = vi.fn()
    const view = renderHook(({ snapshot }) => useSkillLevelEventQueue(snapshot, reload), { initialProps: { snapshot: snapshotWith([]) } })
    await waitFor(() => expect(useSkillLevelEventStore.getState().showing).not.toBeNull())
    expect(ipc.claim.mock.calls[0][1]).toHaveLength(100)
    act(() => { useSkillLevelEventStore.getState().advance() })
    view.rerender({ snapshot: snapshotWith(events.slice(100)) })
    await waitFor(() => expect(ipc.claim).toHaveBeenCalledTimes(2))
    expect(ipc.claim.mock.calls[1][1]).toEqual(['s101'])
  })
  it('initializes, claims in sequence order, presents only returned steps, then reads again', async () => {
    const events = [language(3, 1), skill(1, 'quantity', 1), skill(2, 'requests', 1)]
    ipc.initialize.mockResolvedValue(events)
    ipc.claim.mockImplementation((_target: string, ids: string[]) => Promise.resolve([skill(1, 'quantity', 1), language(3, 1)].filter(event => ids.includes(event.id))))
    const reload = vi.fn()
    const view = renderHook(({ snapshot }) => useSkillLevelEventQueue(snapshot, reload), { initialProps: { snapshot: snapshotWith([]) } })
    await waitFor(() => expect(useSkillLevelEventStore.getState().showing).not.toBeNull())
    expect(ipc.initialize).toHaveBeenCalledWith(skillDemo.target)
    expect(ipc.claim).toHaveBeenCalledWith(skillDemo.target, ['s1', 's2'])
    expect(useSkillLevelEventStore.getState().showing).toMatchObject({ kind: 'skills', events: [{ id: 's1' }] })
    act(() => { useSkillLevelEventStore.getState().advance() })
    expect(useSkillLevelEventStore.getState().showing).toBeNull()
    expect(reload).toHaveBeenCalledOnce()
    view.rerender({ snapshot: snapshotWith([language(3, 1)]) })
    await waitFor(() => expect(useSkillLevelEventStore.getState().showing).toMatchObject({ kind: 'language', event: { id: 'l3' } }))
    expect(ipc.claim).toHaveBeenLastCalledWith(skillDemo.target, ['l3'])
    act(() => { useSkillLevelEventStore.getState().advance() })
    expect(reload).toHaveBeenCalledTimes(2)
  })
  it('claims pending steps from a fresh snapshot once the language is initialized', async () => {
    ipc.initialize.mockResolvedValue([])
    ipc.claim.mockImplementation((_target: string, ids: string[]) => Promise.resolve([language(7, 2)].filter(event => ids.includes(event.id))))
    const reload = vi.fn()
    const view = renderHook(({ snapshot }) => useSkillLevelEventQueue(snapshot, reload), { initialProps: { snapshot: snapshotWith([]) } })
    await waitFor(() => expect(useSkillLevelEventStore.getState().initialized).not.toBeNull())
    view.rerender({ snapshot: snapshotWith([language(7, 2)]) })
    await waitFor(() => expect(useSkillLevelEventStore.getState().showing).toMatchObject({ kind: 'language' }))
    expect(ipc.claim).toHaveBeenCalledOnce()
  })
  it('reports a stale claim and reads again instead of replaying it', async () => {
    ipc.initialize.mockResolvedValue([skill(1, 'quantity', 1)])
    ipc.claim.mockRejectedValue(new Error('stale claim'))
    const reload = vi.fn()
    renderHook(() => useSkillLevelEventQueue(snapshotWith([]), reload))
    await waitFor(() => expect(faults.report).toHaveBeenCalledWith('Skill level celebrations', expect.any(Error)))
    expect(reload).toHaveBeenCalledOnce()
    expect(ipc.claim).toHaveBeenCalledOnce()
    expect(useSkillLevelEventStore.getState().showing).toBeNull()
  })
  it('reads again when every step was already claimed', async () => {
    ipc.initialize.mockResolvedValue([skill(1, 'quantity', 1)])
    ipc.claim.mockResolvedValue([])
    const reload = vi.fn()
    renderHook(() => useSkillLevelEventQueue(snapshotWith([]), reload))
    await waitFor(() => expect(reload).toHaveBeenCalledOnce())
    expect(useSkillLevelEventStore.getState().showing).toBeNull()
  })
})
