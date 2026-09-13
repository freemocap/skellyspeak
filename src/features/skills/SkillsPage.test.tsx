import { SKILL_CATALOG_VERSION } from '../../contracts'
import { skillIndex } from '../../domain/skills/skill-index'
// @vitest-environment jsdom
import { act, fireEvent, render as testingRender, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useState, type ComponentType, type ReactNode } from 'react'
import { SkillTreeView } from './SkillsPage'
import { unreportedInput, type SkillRecord, type SkillSnapshot } from '../../domain/skills/skills'
import { skillDemo } from '../../domain/skills/skillDemo'
import { nodePosition, type TreeLayout } from '../../domain/skills/skillTree'

// Canvas geometry is checked in the browser; these tests exercise the same
// node buttons and inspector without jsdom's missing layout engine.
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ nodes, nodeTypes, children }: { nodes: { id: string; data: object }[]; nodeTypes: { skill: ComponentType<{ data: object }> }; children: ReactNode }) => {
    const Node = nodeTypes.skill
    return <div>{nodes.map((node) => <Node key={node.id} data={node.data} />)}{children}</div>
  },
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  Handle: ({ type, position }: { type: string; position: string }) => <span data-testid={`${type}-handle`} data-position={position} />,
  BackgroundVariant: { Dots: 'dots', Lines: 'lines' },
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
  useUpdateNodeInternals: () => vi.fn(), useNodesInitialized: () => false,
  useNodesState: (initial: object[]) => [...useState(initial), vi.fn()],
  useStore: () => 0,
  useReactFlow: () => ({ fitView: vi.fn() }),
}))


const handlers = () => ({ refresh: vi.fn(), save: vi.fn().mockResolvedValue(undefined), saving: false, onPractice: vi.fn() })
const currentRecord: SkillRecord = {
  attempt_id: 'attempt-a', session_id: 'session-a', turn_id: 42, message_id: 7, replaces_message_id: null,
  chat_id: 'chat-a', learner_id: 'local', target: 'ar', native: 'en', source: 'هذا الكتاب.',
  input: { ...unreportedInput(), suggestion: true }, at_secs: 123, model: 'evaluation-model', provider_mode: 'hosted',
  catalog_version: SKILL_CATALOG_VERSION, prompt_version: 'skill-evidence-4', status: 'complete', error: null,
  assessment: { judgments: [{ skill_id: 'referent', outcome: 'demonstrated', quotes: ['هذا الكتاب.'], rationale: 'Identifiable referent using suggested wording.' }] },
}
function fixture(): SkillSnapshot {
  return { ...skillDemo, learner_id: 'local', target: 'ar', records: [currentRecord], profile: { ...skillDemo.profile, choices: { ...skillDemo.profile.choices, learner_id: 'local', target: 'ar' } } }
}
describe('meaning-domain profile', () => {
  it('keeps every depth in the same scene while inspecting a branch', () => {
    render(<SkillTreeView snapshot={fixture()} demonstration={false} {...handlers()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Map' }))
    const nodes = () => document.querySelectorAll('.tree-node')
    const original = Array.from(nodes())
    expect(original).toHaveLength(displayedTree.length)
    fireEvent.change(screen.getByRole('combobox', { name: 'Inspect' }), { target: { value: 'situating' } })
    expect(Array.from(nodes())).toEqual(original)
    fireEvent.click(screen.getByRole('button', { name: 'Close node details' }))
    expect(Array.from(nodes())).toEqual(original)
  })
  it('preserves the shared taxonomy and keeps every layout separated and mirrored', () => {
    expect(skillTree.filter((n) => n.parent === null)).toHaveLength(1)
    expect(skillTree.filter((n) => n.kind === 'domain').map((n) => n.id)).toEqual(['social', 'descriptions', 'statements', 'situating', 'questions', 'opinions'])
    for (const n of skillTree) {
      const right = nodePosition(n, 'right', skillTree)
      const left = nodePosition(n, 'left', skillTree)
      expect(left.x).toBe(right.x === 0 ? 0 : -right.x)
      expect(left.y).toBe(right.y)
    }
    for (const layout of ['right', 'left', 'down', 'radial'] as TreeLayout[]) {
      const points = skillTree.map((n) => nodePosition(n, layout, skillTree))
      expect(new Set(points.map((p) => `${p.x},${p.y}`)).size).toBe(skillTree.length)
      for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
        expect(Math.abs(points[i].x - points[j].x) >= 180 || Math.abs(points[i].y - points[j].y) >= 70).toBe(true)
      }
    }
  })
  it('saves a selected focus before returning to conversation and exposes evidence provenance', async () => {
    const actions = handlers()
    render(<SkillTreeView snapshot={fixture()} demonstration={false} {...actions} />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Inspect' }), { target: { value: 'referent' } })
    expect(document.querySelector('blockquote')).toHaveTextContent('هذا الكتاب.')
    expect(screen.getByText(/Suggested wording · external assistance unknown/)).toBeVisible()
    fireEvent.click(screen.getByText('Source record'))
    expect(screen.getByText('chat-a / 7')).toBeVisible()
    expect(screen.getByText('42 / session-a')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Practise this in conversation' }))
    await waitFor(() => expect(actions.onPractice).toHaveBeenCalledOnce())
    expect(actions.save).toHaveBeenCalledWith(expect.objectContaining({ focus: 'referent', target: 'ar', revision: 0 }))
    fireEvent.click(screen.getByRole('button', { name: 'Exclude attempt from progress' }))
    await waitFor(() => expect(actions.save).toHaveBeenLastCalledWith(expect.objectContaining({ excluded_attempts: ['attempt-a'] })))
  })
  it('keeps save failures visible without navigating or claiming a saved focus', async () => {
    const actions = handlers(); actions.save.mockRejectedValue(new Error('Profile changed'))
    render(<SkillTreeView snapshot={fixture()} demonstration={false} {...actions} />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Inspect' }), { target: { value: 'past_reference' } })
    fireEvent.click(screen.getByRole('button', { name: 'Practise this in conversation' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Profile changed')
    expect(actions.onPractice).not.toHaveBeenCalled()
  })
  it('follows application direction and preserves inspection through layout changes', async () => {
    const original = document.documentElement.dir
    try {
      document.documentElement.dir = 'rtl'
      render(<SkillTreeView snapshot={skillDemo} demonstration={true} {...handlers()} />)
      fireEvent.click(screen.getByRole('button', { name: 'Map' }))
      expect(screen.getByRole('button', { name: 'Right-left' })).toHaveAttribute('aria-pressed', 'true')
      fireEvent.change(screen.getByRole('combobox', { name: 'Inspect' }), { target: { value: 'past_reference' } })
      await act(async () => { document.documentElement.dir = 'ltr' })
      await waitFor(() => expect(screen.getByRole('button', { name: 'Left-right' })).toHaveAttribute('aria-pressed', 'true'))
      fireEvent.click(screen.getByRole('button', { name: 'Radial' }))
      expect(within(screen.getByRole('complementary')).getByRole('heading', { name: 'Refer to past events' })).toBeVisible()
      await act(async () => { document.documentElement.dir = 'rtl' })
      expect(screen.getByRole('button', { name: 'Radial' })).toHaveAttribute('aria-pressed', 'true')
    } finally { await act(async () => { document.documentElement.dir = original }) }
  })
})

function render(ui: React.ReactNode) { return testingRender(ui) }

const { nodes: skillTree, displayed: displayedTree } = skillIndex(skillDemo).catalog
