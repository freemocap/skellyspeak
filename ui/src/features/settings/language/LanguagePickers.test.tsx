// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { LearningPicker } from './LanguagePickers'
import { useSettingsStore } from '../../../state/settings/settings'
import { useNavigationStore } from '../../../state/navigation/navigation'
import type { Settings } from '../../../types'
vi.mock('../../../platform/ipc/tauri', () => ({ languages: () => [
  {code:'spanish',name:'Spanish',endonym:'Español',defaultVariety:'mexico',varieties:[{id:'mexico',label:'Mexico'}]},
  {code:'arabic',name:'Arabic',endonym:'العربية',defaultVariety:'levantine',varieties:[{id:'levantine',label:'Levantine'},{id:'standard',label:'Modern Standard'}]},
  {code:'german',name:'German',endonym:'Deutsch',varieties:[]},
]}))
const choose = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  choose.mockResolvedValue(undefined)
  useSettingsStore.setState({...useSettingsStore.getInitialState(),settings:{target_language:'spanish',target_variety:'mexico',target_varieties:{arabic:'standard'},my_languages:['arabic']} as unknown as Settings,selectLanguageVariety:choose})
  useNavigationStore.setState(useNavigationStore.getInitialState())
})
function open() { fireEvent.click(screen.getByRole('button',{name:'Target language'})) }
it('shows saved languages and opens the browser without switching', () => {
  render(<LearningPicker />); open()
  expect(screen.queryByRole('button',{name:'Deutsch (German)'})).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button',{name:'Add language…'}))
  expect(useNavigationStore.getState().overlay).toBe('languages')
  expect(choose).not.toHaveBeenCalled()
})
it('opens a language submenu without switching and marks its remembered variety', async () => {
  render(<LearningPicker />); open()
  fireEvent.click(screen.getByRole('button',{name:'العربية (Arabic)'}))
  expect(choose).not.toHaveBeenCalled()
  expect(screen.getByRole('button',{name:'Modern Standard'})).toHaveAttribute('aria-pressed','true')
  fireEvent.click(screen.getByRole('button',{name:'Modern Standard'}))
  await waitFor(() => expect(choose).toHaveBeenCalledWith('arabic','standard'))
})
it('exposes every variant on hover and saves a different variant', async () => {
  render(<LearningPicker />); open()
  fireEvent.mouseEnter(screen.getByRole('button',{name:'العربية (Arabic)'}))
  fireEvent.click(screen.getByRole('button',{name:'العربية (Arabic)'}))
  expect(screen.getByRole('button',{name:'Modern Standard'})).toHaveAttribute('aria-pressed','true')
  fireEvent.click(screen.getByRole('button',{name:'Levantine'}))
  await waitFor(() => expect(choose).toHaveBeenCalledWith('arabic','levantine'))
})
it('supports click disclosure, escape focus return and visible save errors', async () => {
  choose.mockRejectedValueOnce(new Error('Save failed'))
  render(<LearningPicker />); open()
  fireEvent.click(screen.getByRole('button',{name:'العربية (Arabic)'}))
  fireEvent.click(screen.getByRole('button',{name:'Levantine'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('Save failed')
  fireEvent.keyDown(screen.getByRole('button',{name:'Levantine'}),{key:'Escape'})
  expect(screen.getByRole('button',{name:'Target language'})).toHaveFocus()
  expect(screen.getByRole('button',{name:'Target language'})).toHaveAttribute('aria-expanded','false')
})

it('opens variants with the right arrow and returns to the language with the left arrow', async () => {
  render(<LearningPicker />); open()
  const language = screen.getByRole('button',{name:'العربية (Arabic)'})
  fireEvent.keyDown(language,{key:'ArrowRight'})
  await waitFor(() => expect(screen.getByRole('button',{name:'Levantine'})).toHaveFocus())
  fireEvent.keyDown(screen.getByRole('button',{name:'Levantine'}),{key:'ArrowLeft'})
  expect(language).toHaveFocus()
  expect(language).toHaveAttribute('aria-expanded','false')
})

it('keeps visible selection checks distinct from whichever row is hovered', () => {
  render(<LearningPicker />); open()
  const spanish = screen.getByRole('button',{name:'Español (Spanish)'})
  const arabic = screen.getByRole('button',{name:'العربية (Arabic)'})
  expect(spanish).toHaveAttribute('aria-current','true')
  expect(spanish.querySelector('.language-dropdown-check')).toHaveTextContent('✓')
  expect(arabic.querySelector('.language-dropdown-check')).toBeEmptyDOMElement()
  fireEvent.mouseEnter(arabic)
  expect(spanish.querySelector('.language-dropdown-check')).toHaveTextContent('✓')
  expect(screen.getByRole('button',{name:'Modern Standard'}).querySelector('.language-dropdown-check')).toHaveTextContent('✓')
  expect(screen.getByRole('button',{name:'Levantine'}).querySelector('.language-dropdown-check')).toBeEmptyDOMElement()
})

it('keeps the tapped submenu within a narrow viewport and dismisses it on rotation', () => {
  const previousWidth = window.innerWidth
  Object.defineProperty(window, 'innerWidth', { configurable:true, value:390 })
  const view = render(<LearningPicker />)
  vi.spyOn(view.container.querySelector('.language-dropdown')!, 'getBoundingClientRect').mockReturnValue({
    left:44, right:304, top:0, bottom:44, width:260, height:44, x:44, y:0, toJSON:()=>({}),
  })
  open()
  fireEvent.click(screen.getByRole('button',{name:'العربية (Arabic)'}))
  const submenu = screen.getByRole('group',{name:'Variety'})
  expect(submenu).toHaveStyle({left:'195px',width:'195px'})
  fireEvent(window, new Event('resize'))
  expect(screen.queryByRole('group',{name:'Variety'})).not.toBeInTheDocument()
  Object.defineProperty(window, 'innerWidth', { configurable:true, value:previousWidth })
})

it('opens the chosen language information without changing the active conversation', () => {
  render(<LearningPicker />); open()
  fireEvent.click(screen.getByRole('button',{name:'Information: العربية (Arabic)'}))
  expect(useNavigationStore.getState()).toMatchObject({overlay:'languages',languageInfo:'arabic'})
  expect(choose).not.toHaveBeenCalled()
  expect(screen.getByRole('button',{name:'Target language'})).toHaveAttribute('aria-expanded','false')
  useNavigationStore.getState().closeOverlay()
  useNavigationStore.getState().showOverlay('languages')
  expect(useNavigationStore.getState().languageInfo).toBeNull()
})
