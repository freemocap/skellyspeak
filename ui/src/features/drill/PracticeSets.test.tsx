// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../components/localization/i18n'
import type { DrillGenerationPreview, PracticeSetSummary } from '../../generated/contracts'
import { PracticeSets } from './PracticeSets'
import { QuickStart } from './QuickStart'

const api = vi.hoisted(() => ({ getPracticeSets: vi.fn(), previewPracticeSet: vi.fn(), acceptPracticePhrases: vi.fn() }))
vi.mock('../../platform/ipc/practice-sets', () => api)
vi.mock('../../platform/ipc/tauri', () => ({ languageFor: () => ({ direction: 'rtl' }) }))
vi.mock('../../components/reading/TargetMessage', () => ({
  TargetMessage: ({ text, rtl, addToDrill }: { text: string; rtl: boolean; addToDrill?: boolean }) => <div><span dir={rtl ? 'rtl' : 'ltr'}>{text}</span>{addToDrill !== false && <button>Add to Practice</button>}</div>,
}))
const scope = { language: 'arabic', variety: 'arabic-modern-standard', explanation: 'english', explanationVariety: null }
const sets: PracticeSetSummary[] = [
  { set: 'absolute_zero', count: 8, sample: 'نعم.' },
  { set: 'beginner', count: 8, sample: 'هذه الغرفة كبيرة.' },
  { set: 'intermediate', count: 8, sample: 'وصلت أمس.' },
  { set: 'advanced', count: 8, sample: 'على الرغم من أن الاقتراح يبدو واعداً، ينبغي أن ندرس عواقبه المحتملة بعناية.' },
  { set: 'social', count: 16, sample: 'مرحباً!' },
  { set: 'idiomatic', count: 8, sample: 'خير الكلام ما قل ودل.' },
]
const present: DrillGenerationPreview = { requestId: 'bundled:fixture', requested: null, receiptId: null, shortfall: null,
  candidates: [{ candidateId: 'phrase-1', text: 'مرحباً!', translation: null, reported: { difficulty: null, tags: [] },
    verified: { scopeMatchesRequest: true, lengthOk: true, nonEmpty: true, duplicate: false },
    source: { kind: 'bundled', set: 'social', contentHash: 'fixture' } }] }

beforeEach(() => {
  vi.resetAllMocks()
  api.getPracticeSets.mockResolvedValue(sets)
  api.previewPracticeSet.mockResolvedValue(present)
  api.acceptPracticePhrases.mockResolvedValue([{ id: 'kept-card' }])
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})

it('hands selected-variety candidates to the picker without rendering a second picker', async () => {
  const preview = vi.fn(async () => {})
  render(<I18nProvider locale="english"><QuickStart scope={scope} showAgain onShowAgain={vi.fn()}
    onPreview={preview} onClose={vi.fn()} /></I18nProvider>)
  const button = await screen.findByRole('button', { name: 'Add 16 social phrases' })
  for (const { sample } of sets) expect(screen.getByText(sample)).toHaveAttribute('dir', 'rtl')
  expect(screen.queryByRole('button', { name: 'Add to Practice' })).toBeNull()
  fireEvent.click(button)
  await waitFor(() => expect(preview).toHaveBeenCalledWith(present))
  expect(screen.queryByRole('button', { name: 'Keep “مرحباً!”' })).toBeNull()
  expect(api.acceptPracticePhrases).not.toHaveBeenCalled()
  expect(screen.queryByText('Included phrases')).toBeNull()
  expect(screen.queryByText('Ready to add. No generation needed.')).toBeNull()
  expect(api.getPracticeSets).toHaveBeenCalledWith('arabic', 'arabic-modern-standard')
  expect(api.previewPracticeSet).toHaveBeenCalledWith(scope, 'social')
})

it('shows load and import failures and retries the same local operation', async () => {
  api.getPracticeSets.mockRejectedValueOnce(new Error('Invalid phrase bank'))
  api.previewPracticeSet.mockRejectedValueOnce(new Error('Workspace is locked'))
  const added = vi.fn(async () => {})
  render(<I18nProvider locale="english"><PracticeSets scope={scope} layout="buttons" onPreview={added} /></I18nProvider>)
  fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Add 8 beginner phrases' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Workspace is locked')
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await waitFor(() => expect(added).toHaveBeenCalledOnce())
  expect(api.previewPracticeSet.mock.calls).toEqual([[scope, 'beginner'], [scope, 'beginner']])
})

it('prevents repeated presses while importing and ignores completion after dismissal', async () => {
  let finish!: (result: DrillGenerationPreview) => void
  api.previewPracticeSet.mockReturnValue(new Promise<DrillGenerationPreview>(resolve => { finish = resolve }))
  const added = vi.fn(async () => {})
  const busy = vi.fn()
  const view = render(<I18nProvider locale="english"><PracticeSets scope={scope} layout="buttons" onPreview={added} onBusyChange={busy} /></I18nProvider>)
  const action = await screen.findByRole('button', { name: 'Add 8 beginner phrases' })
  fireEvent.click(action); fireEvent.click(action)
  expect(api.previewPracticeSet).toHaveBeenCalledOnce()
  for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled()
  view.unmount()
  await act(async () => finish(present))
  expect(added).not.toHaveBeenCalled()
  expect(busy).toHaveBeenLastCalledWith(false)
})
