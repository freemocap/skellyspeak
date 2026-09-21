import { expect, it } from 'vitest'
import { mediaError } from './media-error'

it('distinguishes playback permission and decoding without retaining device URLs', () => {
  const denied = mediaError({ name: 'NotAllowedError', message: 'Audio output denied at https://private-device.invalid/path?token=secret' }, 'Playback')
  const decode = mediaError({ code: 3, message: 'blob:private recording' }, 'Playback')
  expect(denied.message).toContain('Permission or autoplay')
  expect(decode.message).toContain('Audio decoding failed')
  expect(JSON.stringify(denied)).toContain('Audio output denied')
  expect(JSON.stringify(denied)).not.toContain('private-device')
  expect(JSON.stringify(decode)).not.toContain('private recording')
})

it('retains the device failure explanation and nested cause without credentials', () => {
  const failure = mediaError(new Error('Failed to start the audio device', {
    cause: new Error('Missing autoaudiosink; token=private-token'),
  }), 'Creating reward audio context')
  const serialized = JSON.stringify(failure)
  expect(serialized).toContain('Failed to start the audio device')
  expect(serialized).toContain('Missing autoaudiosink')
  expect(serialized).not.toContain('private-token')
})
