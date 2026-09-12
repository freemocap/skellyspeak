// Playback authority for synthesized speech: lifecycle suspension and the voice
// volume reach whichever utterance is actually playing. The player registers
// itself here, so this module never creates audio and cannot request speech.

export interface ActiveSpeechPlayback {
  /// Release playback and report it finished, so the caller clears its state.
  suspend: () => void
  setVolume: (volume: number) => void
}

let active: ActiveSpeechPlayback | null = null

/// Registration is exclusive: a new utterance replaces the previous one, and a
/// player clears its own registration when it releases.
export function registerSpeechPlayback(playback: ActiveSpeechPlayback | null): void {
  active = playback
}

/** Lifecycle suspension stops the active utterance; returning never resumes it. */
export function setPlaybackAllowed(allowed: boolean): void {
  if (!allowed) active?.suspend()
}

export function setVoiceVolume(volume: number): void {
  if (!Number.isFinite(volume) || volume < 0 || volume > 1) throw new Error('Voice volume must be between 0 and 1.')
  if (volume === 0) { active?.suspend(); return }
  active?.setVolume(volume)
}
