import type { Settings } from '../types'

export type AudioVolumes = Pick<Settings, 'master_volume' | 'voice_volume' | 'effects_volume'>

export function validateAudioVolumes(settings: AudioVolumes): void {
  for (const key of ['master_volume', 'voice_volume', 'effects_volume'] as const) {
    if (settings[key] === undefined) {
      throw new Error(`Settings response is missing the required field: ${key}.`)
    }
    const volume = settings[key]
    if (!Number.isInteger(volume) || volume < 0 || volume > 100) throw new Error(`${key}: Volume must be a whole percentage between 0 and 100%.`)
  }
}
