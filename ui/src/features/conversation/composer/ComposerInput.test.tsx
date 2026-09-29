// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ComposerInput } from './ComposerInput'
const props = () => ({input:'Hola', available:true, sending:false, recording:false, transcribing:false, autoSend:true, targetLanguage:'spanish', targetLanguageName:'Español', onInput:vi.fn(),onSend:vi.fn(),onDiscardRecording:vi.fn(),onToggleRecording:vi.fn()})
it('sends with Enter while preserving Shift+Enter and IME composition', () => {
  const input = props()
  render(<ComposerInput {...input} />)
  const field = screen.getByRole('textbox', {name:'Message'})
  fireEvent.keyDown(field, {key:'Enter',shiftKey:true})
  fireEvent.keyDown(field, {key:'Enter',isComposing:true})
  fireEvent.keyDown(field, {key:'Enter',keyCode:229})
  expect(input.onSend).not.toHaveBeenCalled()
  fireEvent.keyDown(field, {key:'Enter'})
  expect(input.onSend).toHaveBeenCalledExactlyOnceWith('Hola')
})
it.each(['sending','transcribing'] as const)('blocks keyboard and form sends during %s', state => {
  const input=props()
  render(<ComposerInput {...input} {...{[state]:true}} />)
  const field=screen.getByRole('textbox', {name:'Message'})
  fireEvent.keyDown(field,{key:'Enter'})
  fireEvent.submit(field.closest('form')!)
  expect(input.onSend).not.toHaveBeenCalled()
  expect(screen.getByRole('button',{name:'Send'})).toBeDisabled()
})
it('shows the stream instead of the draft while recording, and the draft again after', () => {
  const input=props()
  const view=render(<ComposerInput {...input} recording stream={<p>Live stream</p>} />)
  expect(screen.getByText('Live stream')).toBeInTheDocument()
  expect(screen.queryByRole('textbox', {name:'Message'})).toBeNull()
  expect(screen.queryByRole('button', {name:'Send'})).toBeNull()
  expect(screen.getByRole('button', {name:'Type'})).toBeDisabled()
  view.rerender(<ComposerInput {...input} />)
  expect(screen.getByRole('textbox', {name:'Message'})).toHaveValue('Hola')
})
it('opens an empty draft from Type and offers Chat Auto as coming soon', () => {
  const input={...props(), input:''}
  const onMode=vi.fn()
  render(<ComposerInput {...input} onMode={onMode} />)
  expect(screen.queryByRole('textbox', {name:'Message'})).toBeNull()
  expect(screen.getByText('Press the microphone to start')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', {name:'Type'}))
  expect(screen.getByRole('textbox', {name:'Message'})).toBeInTheDocument()
  fireEvent.click(screen.getByRole('radio', {name:'Auto'}))
  expect(screen.getByText('Coming soon')).toBeInTheDocument()
  expect(onMode).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('radio', {name:'Hold to talk'}))
  expect(onMode).toHaveBeenCalledExactlyOnceWith('hold')
})
it('retains distinct stop and discard controls without submitting the draft', () => {
  const input=props()
  render(<ComposerInput {...input} recording />)
  const discard = screen.getByRole('button',{name:'Discard recording'})
  const microphone = screen.getByRole('button',{name:'Stop and send recording'})
  expect(discard.parentElement).toBe(microphone.parentElement)
  expect(discard.closest('.voice-face')).toBeNull()
  fireEvent.click(discard)
  fireEvent.click(microphone)
  expect(input.onDiscardRecording).toHaveBeenCalledOnce()
  expect(input.onToggleRecording).toHaveBeenCalledOnce()
  expect(input.onSend).not.toHaveBeenCalled()
})

it('keeps recording enabled with a compact model-language warning', () => {
  const input = props()
  const warning = 'The whisper-large-v3 transcription model has no language code for Irish; output may be unreliable.'
  const view = render(<ComposerInput {...input} transcriptionWarning={warning} />)
  expect(screen.getByRole('note').textContent).toBe(warning)
  expect(screen.getByRole('button', { name: 'Record audio' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: 'Record audio' }))
  expect(input.onToggleRecording).toHaveBeenCalledOnce()
  view.rerender(<ComposerInput {...input} />)
  expect(screen.queryByRole('note')).toBeNull()
})
it('says what to say when the page offers it, where screen readers can reach it', () => {
  const input={...props(), input:''}
  const view=render(<ComposerInput {...input} prompt={<>Say <b className="target-word">hola</b> to start</>} />)
  // Unlike the default, which only restates the pad, the greeting is content.
  const prompt=screen.getByText('hola').closest('.voice-prompt')!
  expect(prompt).toHaveTextContent('Say hola to start')
  expect(prompt).not.toHaveAttribute('aria-hidden')
  view.rerender(<ComposerInput {...input} />)
  expect(screen.getByText('Press the microphone to start').closest('.voice-prompt')).toHaveAttribute('aria-hidden', 'true')
})
