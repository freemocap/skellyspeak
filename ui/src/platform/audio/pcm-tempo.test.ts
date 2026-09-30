import { expect, it } from 'vitest'
import { PCM_RATE, PcmTempo } from './pcm-tempo'

function sine(seconds = 1, hz = 220) {
  const bytes = new Uint8Array(PCM_RATE * seconds * 2)
  const view = new DataView(bytes.buffer)
  for (let i = 0; i < bytes.length / 2; i++) view.setInt16(i * 2, Math.round(Math.sin(i * 2 * Math.PI * hz / PCM_RATE) * 16000), true)
  return bytes
}
function render(bytes: Uint8Array, rate: number, chunkSize: number) {
  const tempo = new PcmTempo()
  const samples: number[] = []
  const drain = () => { for (let hop = tempo.next(rate); hop; hop = tempo.next(rate)) samples.push(...hop.samples) }
  for (let offset = 0; offset < bytes.length; offset += chunkSize) { tempo.append(bytes.subarray(offset, offset + chunkSize), offset / 2); drain() }
  tempo.finish(bytes); drain()
  return samples
}

it('passes ordinary-speed PCM unchanged across arbitrary chunk boundaries', () => {
  const bytes = sine()
  const output = render(bytes, 1, 514)
  const view = new DataView(bytes.buffer)
  expect(output).toHaveLength(bytes.length / 2)
  output.forEach((value, i) => expect(value).toBe(view.getInt16(i * 2, true) / 32768))
})

it.each([0.5, 0.8, 1.2, 1.5])('changes duration without transposing pitch at %sx', rate => {
  const bytes = sine(2)
  const output = render(bytes, rate, 1538)
  expect(output.length).toBeCloseTo(PCM_RATE * 2 / rate, -1)
  const middle = output.slice(2400, -2400)
  let crossings = 0
  for (let i = 1; i < middle.length; i++) if (middle[i - 1] < 0 && middle[i] >= 0) crossings++
  expect(crossings * PCM_RATE / middle.length).toBeGreaterThan(215)
  expect(crossings * PCM_RATE / middle.length).toBeLessThan(225)
  expect(output).toEqual(render(bytes, rate, bytes.length))
})

it('does not advance on underruns, and rejects gaps or a different final recording', () => {
  const tempo = new PcmTempo()
  const bytes = sine()
  tempo.append(bytes.subarray(0, 400), 0)
  expect(tempo.next(1)).toBeNull(); expect(tempo.position).toBe(0)
  expect(() => tempo.append(bytes.subarray(400, 600), 201)).toThrow('sequence')
  const altered = bytes.slice(); altered[0] = 10
  expect(() => tempo.finish(altered)).toThrow('does not match')
  tempo.finish(bytes)
  expect(tempo.next(1)?.from).toBe(0)
})
