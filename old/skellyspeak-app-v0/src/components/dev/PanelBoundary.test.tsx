// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PanelBoundary } from './PanelBoundary'
vi.mock('../../lib/faults', () => ({ reportFault: vi.fn() }))
it('contains a failed AI view without removing the conversation', () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  function Broken(): never { throw new Error('Graph import failed') }
  render(<><p>Conversation remains</p><PanelBoundary><Broken /></PanelBoundary></>)
  expect(screen.getByText('Conversation remains')).toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('Graph import failed')
  consoleError.mockRestore()
})
