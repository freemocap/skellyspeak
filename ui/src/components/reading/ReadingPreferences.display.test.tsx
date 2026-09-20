// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { SavedGlossText } from './SavedGlossText'
import { TokenSpan } from './TokenSpan'
import { ReadingPreferencesContext } from './ReadingPreferences'
import { GlossPopup } from '../../features/conversation/reading/GlossPopup'

const combinations = [false, true].flatMap(autoTranslate => [false, true].flatMap(alwaysRomanize =>
  [false, true].map(alwaysPronunciation => ({autoTranslate, alwaysRomanize, alwaysPronunciation}))))
const parts = [
  {start:0, end:1, kind:'gloss' as const, gloss:'meaning', romanization:'roman', pronunciation:'redundant'},
  {start:2, end:3, kind:'gloss' as const, gloss:'other', pronunciation:'fallback'},
]
const token = {text:'a', gloss:'meaning', romanization:'roman', pronunciation:'redundant', notable:false, pos:null}

it.each(combinations)('uses %j for inline aids while keeping requested word help available', preferences => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open','') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  const source = (showAids: boolean) => <ReadingPreferencesContext value={preferences}>
    <SavedGlossText text="a b" segments={parts} showAids={showAids} />
    <TokenSpan tok={token} revealed={false} showAids showTranslation={preferences.autoTranslate} hasTranslation showRomanization
      alwaysRomanize={preferences.alwaysRomanize} alwaysPronunciation={preferences.alwaysPronunciation}
      onTap={vi.fn()} onDragStart={vi.fn()} onDragOver={vi.fn()} />
  </ReadingPreferencesContext>
  const view = render(source(true))
  expect(view.container.querySelectorAll('.wg')).toHaveLength(preferences.autoTranslate ? 3 : 0)
  expect(view.container.querySelectorAll('.wroman')).toHaveLength(preferences.alwaysRomanize ? 2 : 0)
  expect(view.container.querySelectorAll('.wpronunciation')).toHaveLength(preferences.alwaysPronunciation ? 1 : 0)
  expect(screen.queryByText('redundant')).toBeNull()
  view.rerender(source(false))
  fireEvent.click(screen.getAllByRole('button', {name:'a'})[0])
  const help = screen.getByRole('group', {name:'Word help'})
  expect(within(help).getByText('meaning')).toBeVisible()
  expect(within(help).getByText('roman')).toBeVisible()
  expect(within(help).queryByText('redundant')).toBeNull()
  fireEvent.click(within(help).getByRole('button', {name:'Word help'}))
  const dialog = screen.getByRole('dialog', {name:'Word help'})
  expect(within(dialog).getByText('meaning')).toBeVisible()
  expect(within(dialog).getByText('roman')).toBeVisible()
  expect(within(dialog).queryByText('redundant')).toBeNull()
  expect(dialog).not.toHaveTextContent(/Romanization|Pronunciation/)
})

it('keeps requested detail and popup content when always-visible preferences change', () => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open','') }
  const source = (enabled: boolean) => <ReadingPreferencesContext value={{autoTranslate:enabled, alwaysRomanize:enabled, alwaysPronunciation:true}}>
    <SavedGlossText text="a" segments={[parts[0]]} />
    <GlossPopup popup={{text:'popup meaning', romanization:'popup roman', actions:[], x:0, y:0}} onClose={vi.fn()} />
  </ReadingPreferencesContext>
  const view = render(source(true))
  fireEvent.click(screen.getByRole('button', {name:'a'}))
  fireEvent.click(screen.getByRole('button', {name:'Word help'}))
  expect(screen.getByText('popup meaning')).toBeVisible()
  view.rerender(source(false))
  expect(view.container.querySelector('.wg')).toBeNull()
  expect(within(screen.getAllByRole('dialog', {name:'Word help'})[1]).getByText('roman')).toBeVisible()
  expect(screen.queryByText('redundant')).toBeNull()
  expect(screen.getByText('popup meaning')).toBeVisible()
  expect(screen.getByText(/popup roman/)).toBeVisible()
})

it.each([true, false])('shows actual hover help with always-visible aids off (romanization available=%s)', romanized => {
  const view = render(<ReadingPreferencesContext value={{autoTranslate:false,alwaysRomanize:false,alwaysPronunciation:false}}>
    <SavedGlossText text="a" segments={[{...parts[0], romanization:romanized ? 'roman' : undefined, pronunciation:'sound'}]} />
  </ReadingPreferencesContext>)
  expect(view.container.querySelector('.wg,.wroman,.wpronunciation')).toBeNull()
  const pointer = new Event('pointerover', {bubbles:true})
  Object.defineProperty(pointer, 'pointerType', {value:'mouse'})
  fireEvent(view.container.querySelector('.saved-word')!, pointer)
  const help = screen.getByRole('group',{name:'Word help'})
  expect(within(help).getByText('meaning')).toBeVisible()
  expect(within(help).queryByText('roman') != null).toBe(romanized)
  expect(within(help).queryByText('sound') != null).toBe(!romanized)
  expect(help).not.toHaveTextContent(/Word help|Romanization|Pronunciation/)
  expect(screen.getByRole('button',{name:'a'})).toHaveTextContent('a')
})
