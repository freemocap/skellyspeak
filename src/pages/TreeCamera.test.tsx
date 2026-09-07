import { skillIndex } from '../lib/skill-index'
import { skillDemo } from '../lib/skillDemo'
// @vitest-environment jsdom
import { render, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { TreeCamera } from './TreeCamera'
const flow = vi.hoisted(() => ({ fitView: vi.fn(), getViewport: vi.fn(() => ({ x: 123, y: 456, zoom: 0.7 })), setViewport: vi.fn() }))
vi.mock('@xyflow/react', () => ({ useUpdateNodeInternals: () => vi.fn(), useNodesInitialized: () => true, useStore: () => 800, useReactFlow: () => flow }))
it('keeps camera stable on refresh and restores the actual viewport on Back', async () => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0))
  vi.stubGlobal('cancelAnimationFrame', window.clearTimeout)
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  const onRestore = vi.fn(), onCanBackChange = vi.fn()
  const props = { layout: 'right' as const, onRestore, onCanBackChange }
  const view = render(<TreeCamera catalog={skillIndex(skillDemo).catalog} {...props} request={{ sequence: 0, target: 'experience', action: 'whole' }} />)
  await waitFor(() => expect(flow.fitView).toHaveBeenCalledTimes(1))
  view.rerender(<TreeCamera catalog={skillIndex(skillDemo).catalog} {...props} request={{ sequence: 1, target: 'time', action: 'focus' }} />)
  await waitFor(() => expect(flow.fitView).toHaveBeenCalledTimes(2))
  expect(flow.fitView).toHaveBeenLastCalledWith(expect.objectContaining({ duration: 0, nodes: expect.arrayContaining([{ id: 'time' }, { id: 'experience' }, { id: 'past_reference' }]) }))
  view.rerender(<TreeCamera catalog={skillIndex(skillDemo).catalog} {...props} request={{ sequence: 1, target: 'time', action: 'focus' }} />)
  view.rerender(<TreeCamera catalog={skillIndex(skillDemo).catalog} {...props} request={{ sequence: 2, target: 'time', action: 'back' }} />)
  await waitFor(() => expect(flow.setViewport).toHaveBeenCalledWith({ x: 123, y: 456, zoom: 0.7 }, { duration: 0 }))
  expect(flow.fitView).toHaveBeenCalledTimes(2)
  expect(onRestore).toHaveBeenCalledWith('experience')
  expect(onCanBackChange).toHaveBeenLastCalledWith(false)
  vi.unstubAllGlobals()
})
