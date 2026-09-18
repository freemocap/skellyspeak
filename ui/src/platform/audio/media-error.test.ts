import { expect, it } from 'vitest'
import { mediaError } from './media-error'

it('distinguishes playback permission and decoding without retaining device URLs', () => {
  const denied = mediaError({ name: 'NotAllowedError', message: 'private device URL' }, 'Playback')
  const decode = mediaError({ code: 3, message: 'blob:private recording' }, 'Playback')
  expect(denied.message).toContain('Permission or autoplay')
  expect(decode.message).toContain('Audio decoding failed')
  expect(JSON.stringify(denied)).not.toContain('private device')
  expect(JSON.stringify(decode)).not.toContain('private recording')
})
