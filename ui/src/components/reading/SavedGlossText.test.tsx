import { AskCoachContext } from '../learning/AskCoachButton'
// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { SavedGlossText } from './SavedGlossText'

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})

it.each([false, true])('anchors first tap and expands all saved fields on second tap (mobile=%s)', mobile => {
  const media = vi.spyOn(window, 'matchMedia').mockReturnValue({
    matches: mobile, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  } as unknown as MediaQueryList)
  const boxes = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('saved-word-help')
      ? new DOMRect(0, 0, 160, 70) : new DOMRect(120, 300, 40, 30)
  })
  try {
    const view = render(<SavedGlossText text="الأكلة" segments={[
      { start: 0, end: 2, kind: 'gloss', gloss: 'the', romanization: 'al-', pronunciation: 'al' },
      { start: 2, end: 6, kind: 'gloss', gloss: 'dish', romanization: 'aklah', pronunciation: 'ak-la' },
    ]} />)
    const word = screen.getByRole('button', { name: 'الأكلة' })
    fireEvent.click(word)
    const help = screen.getByRole('button', { name: 'Word help' })
    expect(help).toHaveAttribute('popover', 'manual')
    expect(help.style.top).toBe('226px')
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(help)
    const dialog = screen.getByRole('dialog', { name: 'Word help' })
    expect(view.container.querySelector('[popover]')).toBeNull()
    for (const value of ['the dish', 'al-aklah', 'alak-la', 'al-', 'aklah', 'al', 'ak-la']) {
      expect(within(dialog).getByText(value)).toBeVisible()
    }
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(word).toHaveFocus()
    fireEvent.keyDown(word, { key: 'Enter' })
    fireEvent.keyDown(screen.getByRole('button', { name: 'Word help' }), { key: 'Enter' })
    expect(screen.getByRole('dialog', { name: 'Word help' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Close Word help' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  } finally { media.mockRestore(); boxes.mockRestore() }
})


it('closes token details and passes the selected occurrence and saved information to the shared coach action', () => {
  const ask = vi.fn()
  render(<AskCoachContext value={ask}><SavedGlossText text="sí, sí" segments={[
    { start: 0, end: 2, kind: 'gloss', gloss: 'yes' },
    { start: 4, end: 6, kind: 'gloss', gloss: 'indeed', pronunciation: 'see' },
  ]} /></AskCoachContext>)
  fireEvent.click(screen.getAllByRole('button', { name: 'sí' })[1])
  fireEvent.click(screen.getByRole('button', { name: 'Word help' }))
  fireEvent.click(screen.getByRole('button', { name: 'Ask the coach' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(ask).toHaveBeenCalledTimes(1)
  const question = ask.mock.calls[0][0]
  expect(question).toContain('“sí”')
  expect(question).toContain('“sí, sí”')
  expect(question).toContain('indeed')
  expect(question).toContain('see')
  expect(question).not.toContain('"yes"')
})
