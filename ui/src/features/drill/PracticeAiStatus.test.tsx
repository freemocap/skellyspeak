// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { useConnectionHealth } from '../../state/session/connection-health'
import { useNavigationStore } from '../../state/navigation/navigation'
import { useSessionStore } from '../../state/session/session'
import { useAiWindowStore } from '../../state/navigation/ai-window'
import { PracticeAiStatus } from './PracticeAiStatus'

vi.mock('../../platform/ipc/window', () => ({ openAiWindow: vi.fn(), aiWindowState: async () => ({ supported: true, open: false }) }))

function connection(configured: boolean) {
  useSessionStore.setState({ connection: {
    route: 'hosted', signedIn: true, email: '', revision: 1,
    configured, assessmentAdapter: 'jev_choice' as const, standardModel: 'standard', fastModel: 'fast', audio: { transcription: { model: 'whisper-large-v3' }, speech: { model: 'openai/gpt-audio-mini' } }, paused: false,
  } })
  useConnectionHealth.setState({ routes: configured ? { hosted: { revision: 1, status: 'connected', checkedAt: 1, error: null } } : {} })
}

beforeEach(() => {
  useNavigationStore.setState(useNavigationStore.getInitialState())
  useSessionStore.setState(useSessionStore.getInitialState())
  useAiWindowStore.setState({ supported: true, open: false })
})

it('rests with the connected mark and opens the AI View from the pill', () => {
  connection(true)
  const view = render(<PracticeAiStatus transcribing={false} fetchingAudio={false} />)
  const pill = screen.getByRole('button', { name: 'AI Connected' })
  expect(pill).toHaveAttribute('data-configured', 'true')
  expect(view.container.querySelector('.ai-status')).not.toHaveAttribute('data-busy')
  expect(view.container.querySelector('.ai-status-text')).toBeNull()
  fireEvent.click(pill)
  expect(useNavigationStore.getState().overlay).toBe('activity')
})

it('names an attempt’s transcription, with the transcription model on hover', () => {
  connection(true)
  const view = render(<PracticeAiStatus transcribing fetchingAudio={false} />)
  expect(view.container.querySelector('.ai-status')).toHaveAttribute('data-busy', 'true')
  const line = view.container.querySelector('.ai-status-line')
  expect(line).toHaveTextContent('Transcribing recorded audio…')
  expect(line).toHaveAttribute('title', 'speech_transcription · whisper-large-v3')
  expect(view.container.querySelector('.ai-status-announce')).toHaveTextContent('Transcribing recorded audio…')
})

it('names a card’s audio on its way to playback', () => {
  connection(true)
  const view = render(<PracticeAiStatus transcribing={false} fetchingAudio />)
  expect(view.container.querySelector('.ai-status-line')).toHaveTextContent('Fetching card audio…')
})

it('says AI is not connected and opens AI access from the pill', () => {
  connection(false)
  const view = render(<PracticeAiStatus transcribing={false} fetchingAudio={false} />)
  expect(view.container.querySelector('.ai-status-text')).toHaveTextContent('AI not connected')
  fireEvent.click(screen.getByRole('button', { name: 'AI Not Connected' }))
  expect(useNavigationStore.getState().overlay).toBe('settings')
})
