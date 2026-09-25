// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { TargetPhrase } from './TargetPhrase'
import { TargetPassage } from './TargetPassage'
import { ReadingActionsContext, ReadingScopeContext } from './ReadingContext'
import { createDrillItem, deleteDrillItem } from '../../platform/ipc/drill'
vi.mock('../../platform/ipc/tauri', async original => ({...await original<typeof import('../../platform/ipc/tauri')>(), languageFor: () => ({languageTag:'es', direction:'ltr',fontScale:1})}))
vi.mock('../../platform/ipc/drill', () => ({ createDrillItem: vi.fn(), deleteDrillItem: vi.fn(async () => {}) }))
const scope = { language: 'spanish', variety: 'spanish-mexico', explanation: 'english', explanationVariety: null }
it('reads and saves the whole phrase in its own scope, resetting save state on text changes', async () => {
  vi.mocked(createDrillItem).mockResolvedValue({ id: 'saved' } as Awaited<ReturnType<typeof createDrillItem>>)
  const speak = vi.fn()
  const content = (text: string) => <ReadingScopeContext value={scope}><ReadingActionsContext value={{inspect:vi.fn(), speak, stop:vi.fn(), speaking:null}}><TargetPhrase text={text} /></ReadingActionsContext></ReadingScopeContext>
  const view = render(content('Ayer fui al mercado.'))
  fireEvent.click(screen.getByRole('button', {name:'Read aloud: Ayer fui al mercado.'}))
  expect(speak).toHaveBeenCalledWith({text:'Ayer fui al mercado.', start:0, end:20, scope})
  fireEvent.click(screen.getByRole('button', {name:'Add to Drill'}))
  const remove = await screen.findByRole('button', {name:'Remove from Drill'})
  fireEvent.click(remove)
  await screen.findByRole('button', {name:'Add to Drill'})
  expect(deleteDrillItem).toHaveBeenCalledWith('saved')
  fireEvent.click(screen.getByRole('button', {name:'Add to Drill'}))
  await screen.findByRole('button', {name:'Remove from Drill'})
  expect(createDrillItem).toHaveBeenCalledWith({text:'Ayer fui al mercado.', ...scope})
  view.rerender(content('Volví a casa.'))
  await waitFor(() => expect(screen.getByRole('button', {name:'Add to Drill'})).toBeEnabled())
})
it('adds phrase controls to standalone passages without an owner speech callback', () => {
  render(<ReadingScopeContext value={scope}><ReadingActionsContext value={{inspect:vi.fn(),speak:vi.fn(),stop:vi.fn(),speaking:null}}><TargetPassage text="Hola." /></ReadingActionsContext></ReadingScopeContext>)
  const play = screen.getByRole('button', {name:'Speak reply'})
  expect(play).toBeEnabled()
  expect(play).toHaveClass('bubble-corner-control')
  const bubble = play.closest('.msg.chat-message.with-actions')
  expect(bubble).not.toBeNull()
  expect(bubble).toContainElement(screen.getByRole('button', {name:'Add to Drill'}))
  expect(screen.getByRole('button', {name:'Add to Drill'})).toBeEnabled()
})
it('does not draw an empty action box without a language scope', () => {
  const {container} = render(<TargetPhrase text="Hola" />)
  expect(container.querySelector('.target-phrase-actions')).toBeNull()
})

it('keeps inline target words and phrases free of passage toolbars', async () => {
  const { Markdown } = await import('./Markdown')
  const {container} = render(<ReadingScopeContext value={scope}><ReadingActionsContext value={{inspect:vi.fn(),speak:vi.fn(),stop:vi.fn(),speaking:null}}>
    <Markdown text={'Use `de`, `mi hermana`, or كتاب inside a sentence.'} targetCode />
  </ReadingActionsContext></ReadingScopeContext>)
  expect(container.querySelectorAll('.target-text').length).toBeGreaterThanOrEqual(3)
  expect(container.querySelector('.target-phrase-actions')).toBeNull()
  expect(screen.queryByRole('button', {name:'Add to Drill'})).toBeNull()
  expect(screen.queryByRole('button', {name:/Read aloud:/})).toBeNull()
  expect(screen.getByRole('button', {name:'de'})).toBeEnabled()
})
