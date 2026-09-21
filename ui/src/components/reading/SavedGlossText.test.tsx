import { AskCoachContext } from '../learning/AskCoachButton'
// @vitest-environment jsdom
import { fireEvent, render as renderView, screen, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { SavedGlossText as SharedSavedGlossText } from './SavedGlossText'
import { ReadingPreferencesContext } from './ReadingPreferences'

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})

// The reported popup displayed these two clitics in three separate field passes.
const enabled = { autoTranslate: true, alwaysRomanize: true, alwaysPronunciation: true }
function render(node: React.ReactNode) {
  return renderView(node, { wrapper: ({ children }) => <ReadingPreferencesContext value={enabled}>{children}</ReadingPreferencesContext> })
}
function SavedGlossText(props: React.ComponentProps<typeof SharedSavedGlossText>) {
  return <SharedSavedGlossText showAids={false} {...props} />
}

const houses = [
  { start: 0, end: 2, kind: 'gloss' as const, gloss: 'the', romanization: 'al-', pronunciation: 'il' },
  { start: 2, end: 6, kind: 'gloss' as const, gloss: 'houses', romanization: 'buyūt', pronunciation: 'buyuut' },
]

it('groups each Arabic part once with unlabeled romanization and no redundant pronunciation', () => {
  render(<SavedGlossText text="البيوت" segments={houses} />)
  fireEvent.click(screen.getByRole('button', { name: 'البيوت' }))
  const help = screen.getByRole('group', { name: 'Word help' })
  expect(within(help).getAllByText('ال', { exact: true })).toHaveLength(1)
  expect(within(help).getAllByText('بيوت', { exact: true })).toHaveLength(1)
  const parts = help.querySelectorAll('.gloss-help-part')
  expect(parts).toHaveLength(2)
  expect(parts[0]).toHaveTextContent('الtheal-')
  expect(parts[1]).toHaveTextContent('بيوتhousesbuyūt')
  expect(help.querySelector('.wpronunciation')).toBeNull()
  expect(help).not.toHaveTextContent(/Romanization|Pronunciation/)
})

it('shows identical sound values once without field labels', () => {
  render(<SavedGlossText text="البيوت" segments={houses.map(part => ({ ...part, pronunciation: part.romanization }))} />)
  fireEvent.click(screen.getByRole('button', { name: 'البيوت' }))
  const help = screen.getByRole('group', { name: 'Word help' })
  expect(within(help).getAllByText('buyūt', { exact: true })).toHaveLength(1)
  expect(help.querySelector('.wpronunciation')).toBeNull()
  expect(help).not.toHaveTextContent(/Romanization|Pronunciation/)
})

it('keeps actual word help available alongside inline aids without substituting pronunciation', () => {
  render(<ReadingPreferencesContext value={{autoTranslate: true, alwaysRomanize: true, alwaysPronunciation: false}}>
    <SavedGlossText showAids text="البيوت" segments={houses} />
  </ReadingPreferencesContext>)
  fireEvent.click(screen.getByRole('button', { name: 'البيوت' }))
  const help = screen.getByRole('group', { name: 'Word help' })
  expect(within(help).getByText('the')).toBeVisible()
  expect(within(help).getByText('houses')).toBeVisible()
  expect(within(help).getByText('al-')).toBeVisible()
  expect(within(help).getByText('buyūt')).toBeVisible()
  expect(help.querySelector('.wpronunciation')).toBeNull()
  expect(help).not.toHaveTextContent(/Romanization|Pronunciation/)
  expect(screen.getByText('the houses')).toBeVisible()
  expect(screen.getByText('al-buyūt')).toBeVisible()
})

it.each([undefined, ''])('uses unlabeled pronunciation when romanization is unavailable (%s)', romanization => {
  render(<SavedGlossText text="بيوت" segments={[
    { start: 0, end: 4, kind: 'gloss', gloss: 'houses', romanization, pronunciation: 'buyuut' },
  ]} />)
  fireEvent.click(screen.getByRole('button', { name: 'بيوت' }))
  const help = screen.getByRole('group', { name: 'Word help' })
  expect(within(help).getByText('buyuut')).toBeVisible()
  expect(help.querySelector('.wroman')).toBeNull()
  expect(help).not.toHaveTextContent(/Romanization|Pronunciation/)
})

it('does not substitute pronunciation for existing unsupported romanization', () => {
  render(<ReadingPreferencesContext value={{ autoTranslate: false, alwaysRomanize: false, alwaysPronunciation: false, supportsRomanization: false }}>
    <SavedGlossText showAids text="البيوت" segments={houses} />
  </ReadingPreferencesContext>)
  fireEvent.click(screen.getByRole('button', { name: 'البيوت' }))
  const help = screen.getByRole('group', { name: 'Word help' })
  expect(within(help).queryByText('buyuut')).toBeNull()
  expect(help.querySelector('.wroman')).toBeNull()
  expect(help).not.toHaveTextContent(/Romanization|Pronunciation/)
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
    if (mobile) expect(help.parentElement).not.toHaveAttribute('popover')
    else expect(help.parentElement).toHaveAttribute('popover', 'manual')
    expect(help.parentElement!.style.top).toBe('226px')
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(help)
    const dialog = screen.getByRole('dialog', { name: 'Word help' })
    expect(view.container.querySelector('[popover]')).toBeNull()
    for (const value of ['the', 'dish', 'al-', 'aklah']) {
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
