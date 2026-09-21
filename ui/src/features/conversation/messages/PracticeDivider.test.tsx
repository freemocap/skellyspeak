// @vitest-environment jsdom
import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { PracticeDivider } from './PracticeDivider'

it('resizes with a keyboard, uses the full workspace width and resets without touching practice state', () => {
  const workspace = createRef<HTMLDivElement>()
  render(<div ref={workspace}><PracticeDivider workspace={workspace} /></div>)
  vi.spyOn(workspace.current!, 'getBoundingClientRect').mockReturnValue({ width: 1400 } as DOMRect)
  const divider = screen.getByRole('separator')
  fireEvent.keyDown(divider, { key: 'ArrowLeft' })
  expect(divider).toHaveAttribute('aria-valuenow', '380')
  expect(workspace.current?.style.getPropertyValue('--chat-share')).toBe('calc(100% - 380px)')
  fireEvent.keyDown(divider, { key: 'Home' })
  fireEvent.keyDown(divider, { key: 'ArrowRight' })
  expect(divider).toHaveAttribute('aria-valuenow', '0')
  fireEvent.keyDown(divider, { key: 'End' })
  fireEvent.keyDown(divider, { key: 'ArrowLeft' })
  expect(divider).toHaveAttribute('aria-valuenow', '1400')
  fireEvent.doubleClick(divider)
  expect(divider).toHaveAttribute('aria-valuenow', '360')
})
