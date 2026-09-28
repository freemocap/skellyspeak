import type { LiveSpectrogram } from '../../generated/contracts'

/// The live spectrogram as a small external store. The recorder writes each
/// update; only the component that draws it subscribes, so the page around the
/// recorder does not re-render for every frame. It is the spectrogram's
/// counterpart of `WaveSource`.
export interface SpectrumFeed {
  get: () => LiveSpectrogram | null
  subscribe: (listener: () => void) => () => void
}

export function createSpectrumFeed(): SpectrumFeed & { set: (value: LiveSpectrogram | null) => void } {
  let current: LiveSpectrogram | null = null
  const listeners = new Set<() => void>()
  return {
    get: () => current,
    set: value => {
      if (value === current) return
      current = value
      for (const listener of listeners) listener()
    },
    subscribe: listener => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

/// Append newly analysed frames and keep the last twelve seconds, the span the
/// live stream shows.
export function mergeSpectrum(previous: LiveSpectrogram | null, next: LiveSpectrogram): LiveSpectrogram {
  const times = [...(previous?.data.frameStartSeconds ?? []), ...next.data.frameStartSeconds]
  const bins = [...(previous?.data.bins ?? []), ...next.data.bins]
  const first = times.findIndex(time => time + next.data.windowSeconds >= next.endSeconds - 12)
  return { ...next, data: { ...next.data, frameStartSeconds: times.slice(Math.max(0, first)), bins: bins.slice(Math.max(0, first)) } }
}
