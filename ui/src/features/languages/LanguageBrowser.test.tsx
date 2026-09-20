// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { LanguageBrowser } from './LanguageBrowser'
import { useSettingsStore } from '../../state/settings/settings'
import type { Settings } from '../../types'
import type { LanguageInspection } from '../../generated/contracts'

const mocks = vi.hoisted(() => ({ inspect: vi.fn(), getSettings: vi.fn(), save: vi.fn(), membership: vi.fn() }))
vi.mock('../../platform/ipc/content', () => ({ inspectLanguage: mocks.inspect }))
vi.mock('../../platform/ipc/tauri', () => ({
  getSettings: mocks.getSettings,
  languages: () => [
    { code:'arabic', name:'Arabic', endonym:'العربية', defaultVariety:'arabic-levantine', varieties:[{id:'arabic-levantine',label:'Levantine Arabic'},{id:'arabic-modern-standard',label:'Modern Standard Arabic'}] },
    { code:'english', name:'English', endonym:'English', defaultVariety:'english-united-states', varieties:[{id:'english-united-states',label:'United States'}] },
  ],
}))
const current = { my_languages:['arabic','english'], target_varieties:{}, target_language:'arabic', target_variety:'arabic-levantine', native_language:'english', native_variety:'english-united-states' } as Settings
function report(id='arabic-levantine'): LanguageInspection {
  return {
    fingerprint:'content-fingerprint',varietyId:id,review:'needs_review',family:'afro-asiatic',
    language:{id:'arabic',name:'Arabic',nativeName:'العربية',transcriptionLanguage: null, languageTag:'ar',defaultVariety:'arabic-levantine',fontScale:1.5,direction:'rtl',romanization:'arabic:ala-lc-arabic',varieties:[],greeting:{text:'مرحبا',romanized:'marḥaban'},partner:{name:'نور',romanizedName:'Nūr',vibe:['🏛️']}},
    values:[{field:'font_scale',value:'1.5',source:'languages/arabic.yaml#defaults.scalars.font_scale'}],
    rules:[{scope:'assessment',text:'Preserve learner quotations.',source:'languages/arabic.yaml#guidance.0'}],
    schemes:[{id:'arabic:ala-lc-arabic',label:'ALA-LC Arabic',instructions:'Preserve the source.',examples:[['كتاب','kitāb']],sources:['ala_lc_arabic'],review:'needs_review',source:'languages/arabic.yaml#definitions',selected:true,usedBy:['Arabic — Levantine Arabic']}],
    partner:{name:'نور'} as LanguageInspection['partner'],
    sources:[{path:'languages/arabic.yaml',yaml:'schema_version: 1'}],schemaJson:'{}',resolvedJson:'{"context":{}}',learningJson:'{}',conversationJson:'{}',
  }
}
beforeEach(() => {
  vi.clearAllMocks()
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open','') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  mocks.inspect.mockResolvedValue(report())
  mocks.getSettings.mockResolvedValue(current)
  mocks.save.mockImplementation(async (next:Settings) => next)
  useSettingsStore.setState({...useSettingsStore.getInitialState(),settings:current,save:mocks.save,saveMyLanguage:mocks.membership})
})
it('shows resolved content and source definitions without writing preferences', async () => {
  render(<LanguageBrowser onClose={vi.fn()} />)
  expect(await screen.findByText('ALA-LC Arabic · Default')).toBeInTheDocument()
  expect(screen.getByText('kitāb')).toBeInTheDocument()
  expect(screen.getByText('languages/arabic.yaml#defaults.scalars.font_scale')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Full definition'), { target: { value: 'languages/arabic.yaml' } })
  fireEvent.click(screen.getByText('Language details'))
  expect(screen.getByText('schema_version: 1')).toBeVisible()
  expect(screen.queryByText('Explanation context')).not.toBeInTheDocument()
  expect(screen.getByText('Preserve learner quotations.')).toBeVisible()
  expect(mocks.inspect).toHaveBeenCalledWith('arabic','arabic-levantine','english','english-united-states')
  expect(mocks.save).not.toHaveBeenCalled()
})
it('saves the inspected variety only after explicit selection', async () => {
  const close=vi.fn()
  render(<LanguageBrowser onClose={close} />)
  await screen.findByText('kitāb')
  fireEvent.change(screen.getByLabelText('Variety'),{target:{value:'arabic-modern-standard'}})
  await waitFor(() => expect(mocks.inspect).toHaveBeenLastCalledWith('arabic','arabic-modern-standard','english','english-united-states'))
  expect(mocks.save).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button',{name:'Use now'}))
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect(mocks.save).toHaveBeenCalledWith({...current,target_variety:'arabic-modern-standard'},current)
})
it('ignores stale responses after changing the inspected language', async () => {
  let resolve!: (value:LanguageInspection)=>void
  mocks.inspect.mockReturnValueOnce(new Promise<LanguageInspection>(done => {resolve=done}))
  render(<LanguageBrowser onClose={vi.fn()} />)
  fireEvent.click(screen.getByRole('button',{name:'English'}))
  await screen.findByText('kitāb')
  await act(async () => resolve({...report(),fingerprint:'stale-content'}))
  expect(screen.queryByText('stale-content')).not.toBeInTheDocument()
})
it('shows load errors with retry and keeps failed saves open', async () => {
  mocks.inspect.mockRejectedValueOnce(new Error('Content inspection failed'))
  const close=vi.fn()
  render(<LanguageBrowser onClose={close} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Content inspection failed')
  expect(screen.getByRole('button',{name:'Use now'})).toBeDisabled()
  fireEvent.click(screen.getByRole('button',{name:'Retry'}))
  await screen.findByText('kitāb')
  fireEvent.change(screen.getByLabelText('Variety'),{target:{value:'arabic-modern-standard'}})
  await waitFor(() => expect(screen.getByRole('button',{name:'Use now'})).toBeEnabled())
  mocks.save.mockRejectedValueOnce(new Error('Save failed'))
  fireEvent.click(screen.getByRole('button',{name:'Use now'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('Save failed')
  expect(close).not.toHaveBeenCalled()
  expect(useSettingsStore.getState().savingLanguage).toBe(false)
})

it('applies the chosen variety after opening an existing conversation in another language', async () => {
  const close = vi.fn()
  const switched = { ...current, target_language: 'english', target_variety: 'english-united-kingdom' }
  mocks.save.mockResolvedValueOnce(switched).mockResolvedValueOnce({ ...switched, target_variety: 'english-united-states' })
  render(<LanguageBrowser onClose={close} />)
  await screen.findByText('kitāb')
  fireEvent.click(screen.getByRole('button', { name: 'English' }))
  await waitFor(() => expect(mocks.inspect).toHaveBeenLastCalledWith('english', 'english-united-states', 'english', 'english-united-states'))
  fireEvent.click(screen.getByRole('button', { name: 'Use now' }))
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect(mocks.save).toHaveBeenCalledTimes(2)
  expect(mocks.save).toHaveBeenLastCalledWith({ ...switched, target_variety: 'english-united-states' }, switched)
})

it('follows the app native-language context when settings change', async () => {
  render(<LanguageBrowser onClose={vi.fn()} />)
  await screen.findByText('kitāb')
  act(() => useSettingsStore.setState({ settings: { ...current, native_language: 'arabic', native_variety: 'arabic-modern-standard' } }))
  await waitFor(() => expect(mocks.inspect).toHaveBeenLastCalledWith('arabic', 'arabic-levantine', 'arabic', 'arabic-modern-standard'))
})

it('omits empty language-specific sections rather than showing generic filler', async () => {
  mocks.inspect.mockResolvedValue({ ...report(), rules: [] })
  render(<LanguageBrowser onClose={vi.fn()} />)
  await screen.findByText('kitāb')
  expect(screen.queryByRole('heading', { name: 'Language-specific guidance' })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Language-specific goals' })).not.toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Topic' })).not.toBeInTheDocument()
  expect(screen.getAllByText('Preserve the source.')).toHaveLength(1)
})

it('adds without switching and removes only the shortcut', async () => {
  useSettingsStore.setState({ settings: { ...current, my_languages: ['arabic'] } })
  mocks.membership.mockImplementation(async (_language: string, variety: string | null) => {
    useSettingsStore.setState({settings:{...current,my_languages:variety ? ['arabic','english'] : ['arabic']}})
  })
  const close = vi.fn()
  render(<LanguageBrowser onClose={close} />)
  fireEvent.click(screen.getByRole('button', {name:'English'}))
  await waitFor(() => expect(screen.getByRole('button', {name:'Add language'})).toBeEnabled())
  fireEvent.click(screen.getByRole('button', {name:'Add language'}))
  expect(await screen.findByRole('status')).toHaveTextContent('Language added.')
  expect(screen.getByRole('button', {name:'Use now'})).toHaveFocus()
  expect(mocks.membership).toHaveBeenCalledWith('english','english-united-states')
  expect(mocks.save).not.toHaveBeenCalled()
  expect(close).not.toHaveBeenCalled()
  expect(useSettingsStore.getState().settings?.target_language).toBe('arabic')
  fireEvent.click(screen.getByRole('button', {name:'Remove from My languages'}))
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Language removed'))
  expect(mocks.membership).toHaveBeenLastCalledWith('english',null)
  expect(mocks.save).not.toHaveBeenCalled()
})
it('does not remove the active language and filters to My languages', async () => {
  useSettingsStore.setState({settings:{...current,my_languages:[]}})
  render(<LanguageBrowser onClose={vi.fn()} />)
  expect(screen.getByRole('button',{name:'Remove from My languages'})).toBeDisabled()
  fireEvent.click(screen.getByRole('tab',{name:'My languages'}))
  expect(screen.queryByRole('button',{name:'English'})).not.toBeInTheDocument()
  expect(screen.getByRole('button',{name:'العربية (Arabic)'})).toBeInTheDocument()
})
it('keeps a failed addition available to retry without reporting success', async () => {
  useSettingsStore.setState({settings:{...current,my_languages:[]}})
  mocks.membership.mockRejectedValueOnce(new Error('Save failed'))
  render(<LanguageBrowser onClose={vi.fn()} />)
  fireEvent.click(screen.getByRole('button',{name:'English'}))
  await waitFor(() => expect(screen.getByRole('button',{name:'Add language'})).toBeEnabled())
  fireEvent.click(screen.getByRole('button',{name:'Add language'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('Save failed')
  expect(screen.getByRole('button',{name:'Add language'})).toBeEnabled()
  expect(screen.queryByText('Language added. Your current conversation is unchanged.')).not.toBeInTheDocument()
})

it('uses the shared panel tabs with keyboard selection and focus', () => {
  render(<LanguageBrowser onClose={vi.fn()} />)
  const all = screen.getByRole('tab', {name:'All languages'})
  const mine = screen.getByRole('tab', {name:'My languages'})
  expect(all).toHaveClass('panel-tab', 'active')
  fireEvent.keyDown(all, {key:'ArrowRight'})
  expect(mine).toHaveAttribute('aria-selected','true')
  expect(mine).toHaveFocus()
  expect(screen.getByRole('tabpanel')).toHaveAccessibleName('My languages')
  fireEvent.keyDown(mine, {key:'Home'})
  expect(all).toHaveFocus()
  expect(all).toHaveAttribute('aria-selected','true')
})
