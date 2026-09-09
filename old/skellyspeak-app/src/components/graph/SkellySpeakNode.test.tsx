// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { NodeProps } from '@xyflow/react'
import { SkellySpeakNode, type NodeData } from './SkellySpeakNode'

vi.mock('@xyflow/react', () => ({ Handle: () => null, Position: { Left: 'left', Right: 'right' } }))
it('keeps selection distinct from running and failed states', () => {
  const data: NodeData = {
    node: { id: 'reply', label: 'Reply', kind: 'agent_step', operation: 'reply', purpose: 'Write a reply', x: 0, y: 0 },
    state: 'running', run: null, selected: true, onPick: vi.fn(),
  }
  const props: NodeProps = { id: 'reply', type: 'skellyspeak', data, selected: false, dragging: false, draggable: false, selectable: true, deletable: false, isConnectable: false, zIndex: 0, positionAbsoluteX: 0, positionAbsoluteY: 0 }
  const { rerender } = render(<SkellySpeakNode {...props} />)
  expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText('✓ Selected')).toBeVisible()
  expect(screen.getByText('● Running')).toBeVisible()
  rerender(<SkellySpeakNode {...props} data={{ ...data, selected: false, state: 'failed' }} />)
  expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
  expect(screen.queryByText('✓ Selected')).not.toBeInTheDocument()
  expect(screen.getByText('✕ Failed')).toBeVisible()
})
