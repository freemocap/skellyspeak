// @vitest-environment jsdom
import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { PracticeDivider } from './PracticeDivider'

it('resizes with a keyboard, clamps both sides and resets without touching practice state', () => {
  const workspace = createRef<HTMLDivElement>()
  render(<div ref={workspace}><PracticeDivider workspace={workspace} /></div>)
  const divider = screen.getByRole('separator')
  fireEvent.keyDown(divider, { key: 'ArrowLeft' })
  expect(divider).toHaveAttribute('aria-valuenow', '380')
  expect(workspace.current?.style.getPropertyValue('--chat-share')).toBe('calc(100% - 380px)')
  fireEvent.keyDown(divider, { key: 'Home' })
  fireEvent.keyDown(divider, { key: 'ArrowRight' })
  expect(divider).toHaveAttribute('aria-valuenow', '320')
  fireEvent.keyDown(divider, { key: 'End' })
  fireEvent.keyDown(divider, { key: 'ArrowLeft' })
  expect(divider).toHaveAttribute('aria-valuenow', '520')
  fireEvent.doubleClick(divider)
  expect(divider).toHaveAttribute('aria-valuenow', '360')
})
