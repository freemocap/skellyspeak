// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it } from 'vitest'
import { I18nProvider } from '../localization/i18n'
import { ResizeHandle, useStoredSize } from './ResizeHandle'

function Pane({ grow = 1 }: { grow?: 1 | -1 }) {
  const [size, setSize] = useStoredSize('test-pane')
  return <I18nProvider locale="english">
    <ResizeHandle label="Resize test pane" axis="x" grow={grow} size={size} min={100} max={300} measure={() => 200} onResize={setSize} />
    <output>{size ?? 'default'}</output>
  </I18nProvider>
}

beforeEach(() => localStorage.clear())

it('moves from the measured size with the keyboard, clamps, stores and resets', () => {
  render(<Pane />)
  const handle = screen.getByRole('separator', { name: 'Resize test pane' })
  fireEvent.keyDown(handle, { key: 'ArrowRight' })
  expect(screen.getByText('216')).toBeInTheDocument()
  expect(localStorage.getItem('skellyspeak_pane_test-pane')).toBe('216')
  fireEvent.keyDown(handle, { key: 'End' })
  expect(screen.getByText('300')).toBeInTheDocument()
  fireEvent.keyDown(handle, { key: 'ArrowRight' })
  expect(screen.getByText('300')).toBeInTheDocument()
  fireEvent.doubleClick(handle)
  expect(screen.getByText('default')).toBeInTheDocument()
  expect(localStorage.getItem('skellyspeak_pane_test-pane')).toBeNull()
})

it('grows a pane that lies after the divider when the divider moves back', () => {
  render(<Pane grow={-1} />)
  fireEvent.keyDown(screen.getByRole('separator'), { key: 'ArrowLeft' })
  expect(screen.getByText('216')).toBeInTheDocument()
})

it('keeps the stored size, and refuses a corrupt one', () => {
  localStorage.setItem('skellyspeak_pane_test-pane', '150')
  const view = render(<Pane />)
  expect(screen.getByText('150')).toBeInTheDocument()
  view.unmount()
  localStorage.setItem('skellyspeak_pane_test-pane', 'wide')
  expect(() => render(<Pane />)).toThrow(/not a positive number/)
})
