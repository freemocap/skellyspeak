import { SavedReadingProvider } from './SavedReadingProvider'
// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ReadingPreferencesContext } from './ReadingPreferences'
import { ReadingHelp } from './ReadingHelp'
import { useReadingActions, ReadingScopeContext, type ReadingServices } from './ReadingContext'
import { TargetText } from './TargetText'
import { SavedGlossText } from './SavedGlossText'
import { ReadingLanguageScope } from './ReadingLanguageScope'
import type { ReadingResult } from '../../generated/contracts'

vi.mock('../../platform/ipc/tauri', () => ({ languageFor: (language: string) => ({ languageTag: language === 'arabic' ? 'ar' : 'es', romanization: language === 'arabic' ? 'ala' : null }) }))
const scope = { language: 'spanish', variety: 'spanish-spain', explanation: 'english', explanationVariety: 'english-us' }
const languages = [{ code: 'spanish', name: 'Spanish', languageTag: 'es', defaultVariety: 'spanish-spain', varieties: [{ id: 'spanish-spain', label: 'Spain' }] }, { code: 'arabic', name: 'Arabic', languageTag: 'ar', defaultVariety: 'arabic-egypt', varieties: [{ id: 'arabic-egypt', label: 'Egypt' }] }]
const result = { gloss: { coverage: 'complete', segments: [{start:0,end:4,kind:'gloss',gloss:'hello'}] }, audioBase64: null, receipt: { providerId: 'receipt-1' } } as ReadingResult
const services: ReadingServices = { read: vi.fn(), speak: vi.fn(), activity: vi.fn() }
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.mocked(services.read).mockResolvedValue(result)
  vi.mocked(services.speak).mockResolvedValue({ providerId: 'speech-1' })
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
function app(children: React.ReactNode) { return render(<ReadingPreferencesContext value={{autoTranslate:true, alwaysRomanize:true, alwaysPronunciation:true}}><ReadingScopeContext value={scope}><ReadingHelp services={services} languages={languages}>{children}</ReadingHelp></ReadingScopeContext></ReadingPreferencesContext>) }

it('requests help only on an explicit word action and reuses help for the same source and language', async () => {
  app(<TargetText text="Hola" />)
  expect(services.read).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Hola' }))
  await waitFor(() => expect(services.read).toHaveBeenCalledOnce())
  expect(services.read).toHaveBeenCalledWith({ ...scope, text: 'Hola', speech: false }, expect.any(AbortSignal))
  await waitFor(() => expect(screen.getByRole('group', { name: 'Word help' })).toHaveTextContent('hello'))
  fireEvent.click(screen.getByRole('button', { name: 'Hola' }))
  fireEvent.keyDown(screen.getByRole('button', { name: 'Hola' }), { key: 'Enter' })
  await waitFor(() => expect(screen.getByRole('group', { name: 'Word help' })).toHaveTextContent('hello'))
  expect(services.read).toHaveBeenCalledOnce()
})

it('speaks an exact saved source occurrence without fetching glosses or opening its parent action', async () => {
  const parent = vi.fn()
  app(<div onClick={parent}><SavedGlossText text="sí, sí" segments={[{start:0,end:2,kind:'gloss',gloss:'yes'}, {start:4,end:6,kind:'gloss',gloss:'indeed'}]} /></div>)
  fireEvent.click(screen.getAllByRole('button', { name: 'sí' })[1])
  fireEvent.click(screen.getByRole('button', { name: 'Read aloud: sí' }))
  await waitFor(() => expect(services.speak).toHaveBeenCalledWith({ ...scope, text: 'sí', speech: true }, expect.any(AbortSignal), expect.any(Function)))
  expect(services.read).not.toHaveBeenCalled(); expect(parent).not.toHaveBeenCalled()
})

it('reads a language-browser source in its own language, not the active conversation language', async () => {
  app(<ReadingLanguageScope language="arabic" variety="arabic-egypt"><TargetText text="كتاب" /></ReadingLanguageScope>)
  fireEvent.click(screen.getByRole('button', { name: 'كتاب' }))
  await waitFor(() => expect(services.read).toHaveBeenCalledWith(expect.objectContaining({ text:'كتاب', language:'arabic', variety:'arabic-egypt' }), expect.any(AbortSignal)))
})

it('does not show a selection popup or request help when selecting text or clicking controls', () => {
  app(<><textarea aria-label="Config" defaultValue="key: Hola" /><button>Topic</button></>)
  const field = screen.getByRole('textbox') as HTMLTextAreaElement
  field.focus(); field.setSelectionRange(5,9); fireEvent.keyUp(field, {key:'Shift'})
  fireEvent.pointerUp(screen.getByRole('button', {name:'Topic'}))
  fireEvent.click(screen.getByRole('button', {name:'Topic'}))
  expect(screen.queryByRole('button', { name:'Inspect selected text' })).toBeNull()
  expect(services.read).not.toHaveBeenCalled()
  expect(field.value).toBe('key: Hola')
})

it('closes pending work and offers speech even when word meanings fail', async () => {
  vi.mocked(services.read).mockRejectedValue({message:'Provider refused',diagnostics:{request_id:'failed-1'}})
  app(<TargetText text="Hola" />)
  fireEvent.click(screen.getByRole('button', { name:'Hola' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Provider refused'))
  const helper=screen.getByRole('group', { name: 'Word help' })
  expect(helper).toHaveTextContent('failed-1')
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.click(within(helper).getByRole('button',{name:'Read aloud: Hola'}))
  await waitFor(() => expect(services.speak).toHaveBeenCalledOnce())
  fireEvent.click(screen.getByRole('button',{name:'Hola'}))
  expect(vi.mocked(services.read).mock.calls[0][1].aborted).toBe(true)
})


it('keeps the final Arabic word and sentence mounted through hover, request completion, pinning and dismissal', async () => {
  vi.useFakeTimers()
  try {
    const source = 'بتحب البيوت القديمة'
    const gloss = { ...result, gloss: { coverage: 'complete', segments: [{start:11,end:18,kind:'gloss',gloss:'old',romanization:'qadīme'}] } } as ReadingResult
    vi.mocked(services.read).mockResolvedValue(gloss)
    const view = app(<ReadingLanguageScope language="arabic" variety="arabic-egypt"><p data-testid="correction"><TargetText text={source} /></p></ReadingLanguageScope>)
    const word = screen.getByRole('button', {name:'القديمة'})
    const hover = new MouseEvent('pointerover', {bubbles:true})
    Object.defineProperty(hover, 'pointerType', {value:'mouse'})
    fireEvent(word, hover)
    await act(async () => { vi.advanceTimersByTime(350) })
    expect(screen.getByRole('group', {name:'Word help'})).toHaveTextContent('old')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(view.getByTestId('correction').textContent).toBe(source)
    expect(screen.getByRole('button', {name:'القديمة'})).toBe(word)
    expect(word).toBeVisible()
    fireEvent.click(word)
    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(word).toBeVisible()
    fireEvent.keyDown(document, {key:'Escape'})
    expect(screen.queryByRole('group', {name:'Word help'})).toBeNull()
    expect(view.getByTestId('correction').textContent).toBe(source)
    expect(word).toBeVisible()
    expect(services.read).toHaveBeenCalledOnce()
  } finally { vi.useRealTimers() }
})

it('does not request missing meanings for a brief pointer pass', async () => {
  vi.useFakeTimers()
  try {
    app(<TargetText text="Hola" />)
    const word = screen.getByRole('button', {name:'Hola'})
    const hover = new MouseEvent('pointerover', {bubbles:true})
    Object.defineProperty(hover, 'pointerType', {value:'mouse'})
    fireEvent(word, hover)
    await act(async () => { vi.advanceTimersByTime(100) })
    fireEvent.pointerOut(word)
    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(services.read).not.toHaveBeenCalled()
    expect(screen.queryByRole('group', {name:'Word help'})).toBeNull()
    expect(word).toBeVisible()
  } finally { vi.useRealTimers() }
})

it('preserves a selected final Arabic word without turning its selection click into inspection', () => {
  const source = 'بتحب البيوت القديمة'
  app(<TargetText text={source} />)
  const word = screen.getByRole('button', {name:'القديمة'})
  const selected = window.getSelection()!
  const range = document.createRange()
  range.selectNodeContents(word)
  selected.removeAllRanges(); selected.addRange(range)
  try {
    fireEvent.click(word)
    expect(selected.toString()).toBe('القديمة')
    expect(word).toBeVisible()
    expect(services.read).not.toHaveBeenCalled()
    expect(screen.queryByRole('group', {name:'Word help'})).toBeNull()
  } finally { selected.removeAllRanges() }
})


it('shows a conversation word in another sentence synchronously without loading or AI', () => {
  app(<SavedReadingProvider sources={[{scope,text:'La playa.',segments:[{start:3,end:8,kind:'gloss',gloss:'beach',pronunciation:'pla-ya'}]}]}><TargetText text="Otra playa." /></SavedReadingProvider>)
  fireEvent.click(screen.getByRole('button',{name:'playa'}))
  expect(within(screen.getByRole('group', {name:'Word help'})).getByText('beach')).toBeVisible()
  expect(screen.queryByText('Finding word meanings…')).toBeNull()
  expect(services.read).not.toHaveBeenCalled()
})

it('reuses a newly looked-up word synchronously in a different passage', async () => {
  app(<><TargetText text="Hola" /><TargetText text="Hola amigo" /></>)
  fireEvent.click(screen.getAllByRole('button',{name:'Hola'})[0])
  await waitFor(()=>expect(screen.getByText('hello')).toBeVisible())
  fireEvent.click(screen.getAllByRole('button',{name:'Hola'})[0])
  fireEvent.click(screen.getAllByRole('button',{name:'Hola'})[1])
  expect(screen.getByText('hello')).toBeVisible()
  expect(screen.queryByText('Finding word meanings…')).toBeNull()
  expect(services.read).toHaveBeenCalledOnce()
})


it('opens the deep inspector from the same durable cache without asking held AI access', async () => {
  vi.mocked(services.read).mockRejectedValue({code:'admission_held',message:'Daily limit'})
  function InspectSaved() { const actions = useReadingActions(); return <button onClick={() => actions?.inspect({scope,text:'playa',start:0,end:5})}>Inspect saved</button> }
  app(<SavedReadingProvider sources={[{scope,text:'La playa.',segments:[{start:3,end:8,kind:'gloss',gloss:'beach'}]}]}><InspectSaved /></SavedReadingProvider>)
  fireEvent.click(screen.getByRole('button',{name:'Inspect saved'}))
  await waitFor(() => expect(screen.getByRole('dialog',{name:'Word help'})).toBeVisible())
  fireEvent.click(screen.getByRole('button',{name:'playa'}))
  expect(within(screen.getByRole('group', {name:'Word help'})).getByText('beach')).toBeVisible()
  expect(services.read).not.toHaveBeenCalled()
})
