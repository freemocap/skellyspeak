// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ReadingPassage } from './ReadingPassage'
import { ReadingPreferencesContext } from '../../../components/reading/ReadingPreferences'
import { ReadingLookupContext, ReadingScopeContext } from '../../../components/reading/ReadingContext'
import type { ReadingResult } from '../../../generated/contracts'

vi.mock('../../../platform/ipc/tauri', () => ({languageFor: () => ({languageTag:'es'})}))

it('shows requested missing word help on the first click with always-visible aids off', async () => {
  const read = vi.fn().mockResolvedValue({gloss:{segments:[{start:0,end:4,kind:'gloss',gloss:'hello',romanization:'roman',pronunciation:'redundant'}]}} as ReadingResult)
  const source = (enabled:boolean) => <ReadingPreferencesContext value={{autoTranslate:enabled,alwaysRomanize:enabled,alwaysPronunciation:enabled}}>
    <ReadingScopeContext value={{language:'spanish',variety:'spain',explanation:'english',explanationVariety:'american'}}>
      <ReadingLookupContext value={read}><ReadingPassage text="Hola" romanization="sentence roman" /></ReadingLookupContext>
    </ReadingScopeContext>
  </ReadingPreferencesContext>
  const view = render(source(false))
  expect(read).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button',{name:'Word by word'}))
  await waitFor(() => expect(read).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(screen.getByRole('button',{name:'Word by word'})).toBeEnabled())
  expect(view.container.querySelector('.wg')).toHaveTextContent('hello')
  expect(view.container.querySelector('.wroman')).toHaveTextContent('roman')
  fireEvent.click(screen.getByRole('button',{name:'Word by word'}))
  expect(view.container.querySelector('.wg,.wroman,.wpronunciation')).toBeNull()
  view.rerender(source(true))
  expect(screen.getByText('hello')).toBeVisible()
  expect(screen.getByText('roman')).toBeVisible()
  expect(screen.queryByText('sentence roman')).toBeNull()
  expect(screen.queryByText('redundant')).toBeNull()
  expect(read).toHaveBeenCalledTimes(1)
})

it('reveals saved word aids on the first click with all defaults off', () => {
  const view = render(<ReadingPreferencesContext value={{autoTranslate:false,alwaysRomanize:false,alwaysPronunciation:false}}>
    <ReadingPassage text="Hola casa" segments={[
      {start:0,end:4,kind:'gloss',gloss:'hello',romanization:'roman',pronunciation:'redundant'},
      {start:5,end:9,kind:'gloss',gloss:'house',pronunciation:'fallback'},
    ]} />
  </ReadingPreferencesContext>)
  expect(view.container.querySelector('.wg,.wroman,.wpronunciation')).toBeNull()
  const button = screen.getByRole('button',{name:'Word by word'})
  fireEvent.click(button)
  expect(button).toHaveAttribute('aria-expanded','true')
  expect(screen.getByText('hello')).toBeVisible()
  expect(screen.getByText('roman')).toBeVisible()
  expect(screen.getByText('fallback')).toBeVisible()
  expect(screen.queryByText('redundant')).toBeNull()
  fireEvent.click(button)
  expect(button).toHaveAttribute('aria-expanded','false')
  expect(view.container.querySelector('.wg,.wroman,.wpronunciation')).toBeNull()
})
