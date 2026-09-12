import { validateAudioVolumes, type AudioVolumes } from './audio-settings'
import { setVoiceVolume } from './speech'
import { setRewardVolume } from './reward-sounds'

export function configureAudioVolumes(settings: AudioVolumes): void {
  validateAudioVolumes(settings)
  setVoiceVolume(settings.master_volume * settings.voice_volume / 10000)
  setRewardVolume(settings.master_volume * settings.effects_volume / 10000)
}
