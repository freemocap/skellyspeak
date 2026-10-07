// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ReadingTools } from './ReadingTools'
import { useReadingActions } from '../components/reading/ReadingContext'
import { aiTraySlot, useAiTrayStore } from '../state/navigation/ai-tray'

vi.mock('../platform/ipc/native', () => ({ invoke: vi.fn() }))
vi.mock('../platform/ipc/tauri', () => ({ languageFor: () => ({ languageTag: 'es' }), languages: () => [] }))
vi.mock('../platform/audio/reading-speech', () => ({ speakSelection: vi.fn(() => new Promise(() => {})), replaySelectionAudio: vi.fn() }))
const scope = { language: 'spanish', variety: 'spain', explanation: 'english', explanationVariety: 'us' }
const status = () => document.querySelector('.reading-audio-status')

function Speak() {
  const actions = useReadingActions()
  return <button onClick={() => actions?.speak({ scope, text: 'Hola', start: 0, end: 4 })}>Speak</button>
}
function app() { return render(<ReadingTools settings={null} defaultScope={scope} onAsk={null}><Speak /></ReadingTools>) }
/** A page with a recording panel has claimed the AI tray slot. */
function recorderSlot() {
  const slot = document.createElement('div')
  document.body.append(slot)
  const release = aiTraySlot(slot)
  return { slot, release: () => { release?.(); slot.remove() } }
}

beforeEach(() => { useAiTrayStore.setState({ slot: null }) })

it('on a phone, read-aloud status rises in the recording panel\'s tray slot', () => {
  const media = vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: query === '(max-width: 860px)', media: query, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList))
  const recorder = recorderSlot()
  try {
    app()
    fireEvent.click(screen.getByRole('button', { name: 'Speak' }))
    expect(status()!.parentElement).toBe(recorder.slot)
  } finally { recorder.release(); media.mockRestore() }
})

it('on a wide screen, read-aloud status floats in the corner even when a page offers a slot', () => {
  const recorder = recorderSlot()
  try {
    app()
    fireEvent.click(screen.getByRole('button', { name: 'Speak' }))
    expect(status()!.parentElement).toBe(document.body)
    expect(status()).toHaveAttribute('popover', 'manual')
  } finally { recorder.release() }
})
