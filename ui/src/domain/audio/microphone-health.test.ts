import { expect, it } from 'vitest'
import { MicrophoneMonitor } from './microphone-health'

it('distinguishes delivered silence from absent samples and recovers on sound', () => {
  const monitor = new MicrophoneMonitor(0)
  expect(monitor.update([], 100).signal).toBe('waiting')
  expect(monitor.update([0, 0], 4000).signal).toBe('quiet')
  expect(monitor.update([0.1, -0.1], 4100)).toMatchObject({ signal: 'sound', detected: true })
  expect(monitor.update([], 7200).signal).toBe('stalled')
})

it('does not call ordinary pauses failures or mistake low input for no samples', () => {
  const monitor = new MicrophoneMonitor(0)
  monitor.update([0.2], 100)
  expect(monitor.update([0], 2000).signal).toBe('sound')
  expect(monitor.update([0.00001], 5000).signal).toBe('quiet')
  expect(monitor.update([0.2], 5100).signal).toBe('sound')
})

it('remembers whether any sound rose above the floor and how long it has run', () => {
  const monitor = new MicrophoneMonitor(1000)
  expect(monitor.heard).toBe(false)
  monitor.update([0, 0], 1500)
  expect(monitor.heard).toBe(false)
  expect(monitor.elapsed(2500)).toBe(1500)
  monitor.update([0.05], 2600)
  expect(monitor.heard).toBe(true)
})
