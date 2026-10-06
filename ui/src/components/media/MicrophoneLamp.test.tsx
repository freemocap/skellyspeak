// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { MicrophoneLamp } from './MicrophoneLamp'
import { I18nProvider } from '../localization/i18n'
import type { MicrophonePresence } from '../../platform/audio/useMicrophonePresence'

const connected: MicrophonePresence = { state: 'connected', label: 'USB headset', detail: null }
const lamp = (props: Partial<Parameters<typeof MicrophoneLamp>[0]>) => <I18nProvider locale="english">
  <MicrophoneLamp phase="ready" health={null} presence={null} onOpen={() => {}} {...props} /></I18nProvider>

it('rests as a quiet Mic mark that names the device and opens recording settings', () => {
  const onOpen = vi.fn()
  const { container } = render(lamp({ presence: connected, onOpen }))
  const button = screen.getByRole('button', { name: 'Microphone: USB headset' })
  expect(button).toHaveTextContent('Mic')
  expect(container.querySelector('.voice-lamp')).toHaveAttribute('data-tone', 'idle')
  expect(container.querySelector('.voice-lamp-announce')).toBeEmptyDOMElement()
  fireEvent.click(button)
  expect(onOpen).toHaveBeenCalledOnce()
})

it('says only Microphone when nothing is known about the device', () => {
  render(lamp({}))
  expect(screen.getByRole('button', { name: 'Microphone' })).toHaveTextContent('Mic')
})

it('glows with the level while sound arrives, naming the capture device in its tooltip', () => {
  const { container } = render(lamp({ phase: 'recording', deviceLabel: 'Yeti X', health: { signal: 'sound', level: 0.6, detected: true } }))
  expect(container.querySelector('.voice-lamp')).toHaveAttribute('data-tone', 'live')
  const button = screen.getByRole('button', { name: 'Sound detected' })
  expect(button).toHaveAttribute('title', 'Yeti X · Sound detected')
  expect(button.style.getPropertyValue('--lamp-level')).toBe('0.6')
  expect(button).toHaveTextContent('Mic')
})

it('listens before any sound arrives', () => {
  const { container } = render(lamp({ phase: 'recording', health: { signal: 'waiting', level: 0, detected: false } }))
  expect(container.querySelector('.voice-lamp')).toHaveAttribute('data-tone', 'live')
  expect(screen.getByRole('button', { name: 'Listening' })).toBeInTheDocument()
})

it('turns to Quiet and announces it after sustained silence', () => {
  const { container } = render(lamp({ phase: 'recording', health: { signal: 'quiet', level: 0.02, detected: true } }))
  expect(container.querySelector('.voice-lamp')).toHaveAttribute('data-tone', 'quiet')
  expect(screen.getByRole('button', { name: 'Very little sound is reaching this microphone. Check mute or move closer.' })).toHaveTextContent('Quiet')
  expect(container.querySelector('.voice-lamp-announce')).toHaveTextContent('Very little sound is reaching this microphone. Check mute or move closer.')
})

it('turns to Stopped when samples stop arriving', () => {
  const { container } = render(lamp({ phase: 'recording', health: { signal: 'stalled', level: 0, detected: true } }))
  expect(container.querySelector('.voice-lamp')).toHaveAttribute('data-tone', 'stalled')
  expect(screen.getByRole('button', { name: 'The microphone stopped sending audio. Check its connection.' })).toHaveTextContent('Stopped')
})

it('says Not connected while the saved device is absent, with the reason in the tooltip', () => {
  const { container } = render(lamp({ presence: { state: 'missing', label: 'USB headset', detail: 'The device is in use.' } }))
  expect(container.querySelector('.voice-lamp')).toHaveAttribute('data-tone', 'missing')
  const button = screen.getByRole('button', { name: 'This microphone is not connected. Choose another in Recording settings.' })
  expect(button).toHaveTextContent('Not connected')
  expect(button).toHaveAttribute('title', 'USB headset · This microphone is not connected. Choose another in Recording settings. · The device is in use.')
  expect(container.querySelector('.voice-lamp-announce')).toHaveTextContent('This microphone is not connected.')
})

it('lets a live recording outrank a stale missing device', () => {
  const { container } = render(lamp({ phase: 'recording', presence: { state: 'missing', label: null, detail: null }, health: { signal: 'sound', level: 0.3, detected: true } }))
  expect(container.querySelector('.voice-lamp')).toHaveAttribute('data-tone', 'live')
})

it('keeps a failed listing visible in the tooltip without raising an alarm', () => {
  const { container } = render(lamp({ presence: { state: 'unknown', label: null, detail: 'The system would not list microphones' } }))
  expect(container.querySelector('.voice-lamp')).toHaveAttribute('data-tone', 'idle')
  expect(screen.getByRole('button', { name: 'Microphone' })).toHaveAttribute('title', 'Microphone · The system would not list microphones')
})
