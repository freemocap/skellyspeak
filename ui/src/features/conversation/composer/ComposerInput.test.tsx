// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { ComposerInput } from './ComposerInput'
const props = () => ({input:'Hola', available:true, sending:false, recording:false, transcribing:false, autoSend:true, targetLanguage:'es', targetLanguageName:'Español', onInput:vi.fn(),onSend:vi.fn(),onDiscardRecording:vi.fn(),onToggleRecording:vi.fn()})
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
it.each(['sending','recording','transcribing'] as const)('blocks keyboard and form sends during %s', state => {
  const input=props()
  render(<ComposerInput {...input} {...{[state]:true}} />)
  const field=screen.getByRole('textbox', {name:'Message'})
  fireEvent.keyDown(field,{key:'Enter'})
  fireEvent.submit(field.closest('form')!)
  expect(input.onSend).not.toHaveBeenCalled()
  expect(screen.getByRole('button',{name:'Send'})).toBeDisabled()
})
it('retains distinct stop and discard controls without submitting the draft', () => {
  const input=props()
  render(<ComposerInput {...input} recording />)
  fireEvent.click(screen.getByRole('button',{name:'Discard recording'}))
  fireEvent.click(screen.getByRole('button',{name:'Stop and send recording'}))
  expect(input.onDiscardRecording).toHaveBeenCalledOnce()
  expect(input.onToggleRecording).toHaveBeenCalledOnce()
  expect(input.onSend).not.toHaveBeenCalled()
})
