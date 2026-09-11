import { expect, it } from 'vitest'
import { encodeRecording } from './browser-recording'

it('encodes microphone samples as bounded mono PCM WAV', () => {
  const buffer = { duration: 0.001, length: 3, sampleRate: 48000, numberOfChannels: 2,
    getChannelData: () => new Float32Array([-1, 0, 1]) } as unknown as AudioBuffer
  const bytes = encodeRecording(buffer)
  const view = new DataView(bytes.buffer)
  expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('RIFF')
  expect(view.getUint16(22, true)).toBe(1)
  expect(view.getUint32(24, true)).toBe(48000)
  expect(view.getUint32(40, true)).toBe(6)
  expect([44, 46, 48].map(offset => view.getInt16(offset, true))).toEqual([-32768, 0, 32767])
})
it('rejects recordings exceeding the shared duration limit', () => {
  expect(() => encodeRecording({ duration: 121 } as AudioBuffer)).toThrow('duration')
})
