import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DemoApp } from './DemoApp'

// A component accidentally reaching an external system must fail the exercise,
// including read-only native requests and chart preference persistence.
const native = vi.hoisted(() => vi.fn(() => { throw new Error('Docs examples must not invoke native commands') }))
vi.mock('@tauri-apps/api/core', async importOriginal => ({ ...await importOriginal<typeof import('@tauri-apps/api/core')>(), invoke: native }))
let fetchSpy: ReturnType<typeof vi.fn>
let storageRead: ReturnType<typeof vi.spyOn>
let storageWrite: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  native.mockClear()
  fetchSpy = vi.fn(() => { throw new Error('Docs examples must not make requests') })
  vi.stubGlobal('fetch', fetchSpy)
  storageRead = vi.spyOn(Storage.prototype, 'getItem')
  storageWrite = vi.spyOn(Storage.prototype, 'setItem')
})
afterEach(() => {
  expect(native).not.toHaveBeenCalled()
  expect(fetchSpy).not.toHaveBeenCalled()
  expect(storageRead).not.toHaveBeenCalled()
  expect(storageWrite).not.toHaveBeenCalled()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('offline documentation examples', () => {
  it('follows the wordmark to Chat and switches teaching examples', async () => {
    const user = userEvent.setup()
    render(<DemoApp initialView="navigation" />)
    await user.click(screen.getByRole('button', { name: 'SkellySpeak home — Chat' }))
    expect(screen.getByRole('heading', { name: 'Send a message' })).toBeInTheDocument()
    await user.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Practice' }))
    expect(screen.getByRole('heading', { name: 'Repeat a practice card' })).toBeInTheDocument()
  })
  it('edits a draft and sends a fixed reply without assessing or storing it', async () => {
    const user = userEvent.setup()
    render(<DemoApp initialView="chat" />)
    await user.click(screen.getByRole('button', { name: 'Type' }))
    await user.clear(screen.getByRole('textbox', { name: 'Message' }))
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'My private example')
    await user.click(screen.getByRole('button', { name: 'Send' }))
    expect(screen.getByText('Fixed example reply')).toBeInTheDocument()
    expect(screen.getByText('The text you typed is not assessed in this example.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Translation' }))
    expect(screen.getByText('What did you do at the weekend?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reset example' }))
    expect(screen.queryByText('Fixed example reply')).not.toBeInTheDocument()
  })
  it('creates a fixed attempt, opens its history, and separates cards', async () => {
    const user = userEvent.setup()
    render(<DemoApp initialView="practice" />)
    await user.click(screen.getByRole('button', { name: 'Start recording' }))
    await user.click(screen.getByRole('button', { name: 'Stop recording' }))
    await user.click(screen.getByText('Sample transcript 1'))
    expect(screen.getByText(/Fixed transcript, not recognized speech/)).toBeVisible()
    await user.click(screen.getByRole('button', { name: /^¿Dónde está la estación/ }))
    expect(screen.getByText('No sample attempts for this card yet.')).toBeInTheDocument()
  })
  it('selects a skill and changes the real chart type without persistence', async () => {
    const user = userEvent.setup()
    render(<DemoApp initialView="skills" />)
    const choices = within(screen.getByLabelText('Select a skill')).getAllByRole('button')
    await user.click(choices[1])
    expect(screen.getByRole('heading', { level: 2, name: choices[1].textContent! })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Chart controls' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Bars' }))
    expect(screen.getByRole('button', { name: 'Bars' })).toHaveAttribute('aria-pressed', 'true')
  })
})
