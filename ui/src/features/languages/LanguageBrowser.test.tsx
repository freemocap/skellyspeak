// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ReadingScopeContext } from '../../components/reading/ReadingContext'
import { LanguageBrowser } from './LanguageBrowser'
import { useSettingsStore } from '../../state/settings/settings'
import type { Settings } from '../../types'
import type { LanguageInspection } from '../../generated/contracts'

const mocks = vi.hoisted(() => ({ inspect: vi.fn(), getSettings: vi.fn(), save: vi.fn(), membership: vi.fn() }))
vi.mock('../../platform/ipc/content', () => ({ inspectLanguage: mocks.inspect }))
vi.mock('../../platform/ipc/tauri', () => ({
  getSettings: mocks.getSettings,
  languageFor: (language: string, variety?: string) => {
    if (variety && !variety.startsWith(`${language}-`)) throw new Error('The selected variety is unavailable.')
    return null
  },
  languages: () => [
    { code:'arabic', name:'Arabic', endonym:'العربية', defaultVariety:'arabic-levantine', varieties:[{id:'arabic-levantine',label:'Levantine'},{id:'arabic-modern-standard',label:'Modern Standard'}] },
    { code:'scottish-gaelic', name:'Scottish Gaelic', endonym:'Gàidhlig', defaultVariety:'scottish-gaelic-scotland', varieties:[{id:'scottish-gaelic-scotland',label:'Scotland'}] },
    { code:'french', name:'French', endonym:'Français', defaultVariety:'french-france', varieties:[{id:'french-france',label:'France'}] },
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
    schemes:[{id:'arabic:ala-lc-arabic',label:'ALA-LC Arabic',instructions:'Preserve the source.',examples:[['كتاب','kitāb']],sources:['ala_lc_arabic'],review:'needs_review',source:'languages/arabic.yaml#definitions',selected:true,usedBy:['Arabic — Levantine']}],
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
  expect(screen.getByText('schema_version: 1')).toBeVisible()
  expect(screen.queryByText('Explanation context')).not.toBeInTheDocument()
  expect(screen.getByText('Preserve learner quotations.')).toBeVisible()
  expect(mocks.inspect).toHaveBeenCalledWith('arabic','arabic-levantine','english','english-united-states')
  expect(mocks.save).not.toHaveBeenCalled()
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

it('does not remove the active language and filters to My languages', async () => {
  useSettingsStore.setState({settings:{...current,my_languages:[]}})
  render(<LanguageBrowser onClose={vi.fn()} />)
  expect(screen.getByRole('checkbox',{name:'العربية (Arabic)'})).toBeDisabled()
  fireEvent.click(screen.getByRole('tab',{name:'My languages'}))
  expect(screen.queryByRole('button',{name:'English'})).not.toBeInTheDocument()
  expect(screen.getByRole('button',{name:'العربية (Arabic)'})).toBeInTheDocument()
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


it('saves checkbox membership immediately in both directions without switching', async () => {
  useSettingsStore.setState({settings:{...current,my_languages:['arabic']}})
  mocks.membership.mockImplementation(async (_language: string, variety: string | null) => {
    useSettingsStore.setState({settings:{...current,my_languages:variety ? ['arabic','english'] : ['arabic']}})
  })
  render(<LanguageBrowser onClose={vi.fn()} />)
  const checkbox = screen.getByRole('checkbox',{name:'English'})
  fireEvent.click(checkbox)
  await waitFor(() => expect(checkbox).toBeChecked())
  expect(mocks.membership).toHaveBeenCalledWith('english','english-united-states')
  expect(screen.queryByRole('button',{name:'Add selected languages'})).not.toBeInTheDocument()
  expect(screen.queryByRole('button',{name:'Use now'})).not.toBeInTheDocument()
  await waitFor(() => expect(checkbox).toBeEnabled())
  fireEvent.click(checkbox)
  await waitFor(() => expect(checkbox).not.toBeChecked())
  expect(mocks.membership).toHaveBeenLastCalledWith('english',null)
  expect(mocks.save).not.toHaveBeenCalled()
})

it('leaves a failed checkbox save unchecked and reports the error', async () => {
  useSettingsStore.setState({settings:{...current,my_languages:['arabic']}})
  mocks.membership.mockRejectedValueOnce(new Error('Save failed'))
  render(<LanguageBrowser onClose={vi.fn()} />)
  fireEvent.click(screen.getByRole('checkbox',{name:'English'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('Save failed')
  expect(screen.getByRole('checkbox',{name:'English'})).not.toBeChecked()
  expect(screen.getByRole('checkbox',{name:'English'})).toBeEnabled()
})

it('shows details immediately and offers a persisted script-size control', async () => {
  const saveScriptScale = vi.fn().mockResolvedValue(undefined)
  useSettingsStore.setState({saveScriptScale})
  render(<LanguageBrowser onClose={vi.fn()} />)
  expect(await screen.findByText('kitāb')).toBeVisible()
  expect(screen.queryByText('Language details')).not.toBeInTheDocument()
  fireEvent.change(screen.getByRole('spinbutton',{name:'Script size'}),{target:{value:'1.37'}})
  fireEvent.blur(screen.getByRole('spinbutton',{name:'Script size'}))
  await waitFor(() => expect(saveScriptScale).toHaveBeenCalledWith('arabic',1.37))
  act(() => useSettingsStore.setState({settings:{...current,script_scales:{arabic:1.37}}}))
  fireEvent.click(screen.getByRole('button',{name:'Default (1.5×)'}))
  await waitFor(() => expect(saveScriptScale).toHaveBeenLastCalledWith('arabic',null))
})

it('opens directly on the requested language with its remembered variety', async () => {
  useSettingsStore.setState({settings:{...current,target_language:'english',target_variety:'english-united-states',target_varieties:{arabic:'arabic-modern-standard'}}})
  render(<LanguageBrowser initialLanguage="arabic" onClose={vi.fn()} />)
  await waitFor(() => expect(mocks.inspect).toHaveBeenCalledWith('arabic','arabic-modern-standard','english','english-united-states'))
  expect(screen.getByRole('combobox',{name:'Variety'})).toHaveValue('arabic-modern-standard')
  expect(mocks.save).not.toHaveBeenCalled()
  expect(mocks.membership).not.toHaveBeenCalled()
})

it('switches loaded details to Gaelic safely inside the app reading scope', async () => {
  const gaelic = { ...report('scottish-gaelic-scotland'), language: { ...report().language, id: 'scottish-gaelic', name: 'Scottish Gaelic', nativeName: 'Gàidhlig' }, fingerprint: 'gaelic-content', schemes: [] }
  let resolve!: (value: LanguageInspection) => void
  mocks.inspect.mockResolvedValueOnce(report()).mockReturnValueOnce(new Promise<LanguageInspection>(done => { resolve = done }))
  render(<ReadingScopeContext value={{ language: 'arabic', variety: 'arabic-levantine', explanation: 'english', explanationVariety: 'english-united-states' }}>
    <LanguageBrowser onClose={vi.fn()} />
  </ReadingScopeContext>)
  await screen.findByText('kitāb')
  fireEvent.click(screen.getByRole('button', { name: 'Gàidhlig (Scottish Gaelic)' }))
  expect(screen.queryByText('kitāb')).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Loading…')
  await act(async () => resolve(gaelic))
  expect(screen.getByText('gaelic-content')).toBeInTheDocument()
  expect(document.querySelector('[data-reading-language="scottish-gaelic"]')).toHaveAttribute('data-reading-variety', 'scottish-gaelic-scotland')
})

it('hides the previous variety report while the selected variety loads', async () => {
  let resolve!: (value: LanguageInspection) => void
  mocks.inspect.mockResolvedValueOnce(report()).mockReturnValueOnce(new Promise<LanguageInspection>(done => { resolve = done }))
  render(<LanguageBrowser onClose={vi.fn()} />)
  await screen.findByText('kitāb')
  fireEvent.change(screen.getByRole('combobox', { name: 'Variety' }), { target: { value: 'arabic-modern-standard' } })
  expect(screen.queryByText('kitāb')).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Loading…')
  await act(async () => resolve({ ...report('arabic-modern-standard'), fingerprint: 'standard-content' }))
  expect(screen.getByText('standard-content')).toBeInTheDocument()
})

it('ignores a rejected request after switching back to loaded language details', async () => {
  let reject!: (reason: Error) => void
  mocks.inspect.mockResolvedValueOnce(report())
    .mockReturnValueOnce(new Promise<LanguageInspection>((_resolve, fail) => { reject = fail }))
    .mockResolvedValueOnce({ ...report(), fingerprint: 'latest-arabic' })
  render(<ReadingScopeContext value={{ language: 'arabic', variety: 'arabic-levantine', explanation: 'english', explanationVariety: 'english-united-states' }}>
    <LanguageBrowser onClose={vi.fn()} />
  </ReadingScopeContext>)
  await screen.findByText('kitāb')
  fireEvent.click(screen.getByRole('button', { name: 'Gàidhlig (Scottish Gaelic)' }))
  fireEvent.click(screen.getByRole('button', { name: 'العربية (Arabic)' }))
  await screen.findByText('latest-arabic')
  await act(async () => reject(new Error('Old Gaelic request failed')))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByText('latest-arabic')).toBeInTheDocument()
})
