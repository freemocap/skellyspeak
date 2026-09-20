// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CoachChatLayout } from './CoachChatLayout'

function layout(hidden = false) {
  return <CoachChatLayout hidden={hidden} content={<p>Saved feedback</p>}
    thread={<p>Saved coach reply</p>} notices={<p role="alert">Request failed</p>}
    composer={<textarea aria-label="Draft" defaultValue="Keep this draft" />} />
}
describe('internal coach split', () => {
  it('minimizes only history, keeping the composer, errors and feedback visible', () => {
    render(layout())
    expect(screen.getByText('Saved coach reply')).not.toBeVisible()
    expect(screen.getByText('Saved feedback')).toBeVisible()
    expect(screen.getByRole('alert')).toBeVisible()
    expect(screen.getByLabelText('Draft')).toHaveValue('Keep this draft')
    fireEvent.click(screen.getByRole('button', { name: 'Expand coach chat' }))
    expect(screen.getByText('Saved coach reply')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Minimize coach chat' }))
    expect(screen.getByLabelText('Draft')).toHaveValue('Keep this draft')
  })
  it('resizes with keyboard within bounds and restores the selected height after minimizing', () => {
    const view = render(layout())
    const separator = screen.getByRole('separator', { name: 'Coach chat height' })
    fireEvent.keyDown(separator, { key: 'ArrowUp' })
    expect(separator).toHaveAttribute('aria-valuenow', '5')
    fireEvent.keyDown(separator, { key: 'End' })
    fireEvent.keyDown(separator, { key: 'ArrowUp' })
    expect(separator).toHaveAttribute('aria-valuenow', '70')
    fireEvent.keyDown(separator, { key: 'ArrowDown' })
    fireEvent.keyDown(separator, { key: 'Home' })
    fireEvent.keyDown(separator, { key: 'ArrowDown' })
    expect(separator).toHaveAttribute('aria-valuenow', '0')
    fireEvent.keyDown(separator, { key: 'Enter' })
    expect(separator).toHaveAttribute('aria-valuenow', '65')
    view.rerender(layout(true))
    view.rerender(layout())
    expect(separator).toHaveAttribute('aria-valuenow', '65')
    expect(screen.getByLabelText('Draft')).toHaveValue('Keep this draft')
  })
})
