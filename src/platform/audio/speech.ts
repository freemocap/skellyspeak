// Playback authority for synthesized speech: lifecycle suspension and the voice
// volume reach whichever utterance is actually playing. The player registers
// itself here, so this module never creates audio and cannot request speech.

export interface ActiveSpeechPlayback {
  /// Release playback and report it finished, so the caller clears its state.
  suspend: () => void
  setVolume: (volume: number) => void
}

let active: ActiveSpeechPlayback | null = null
// A permit is invalidated by suspension even if focus returns before an async
// audio read completes. Returning to the app must never resume abandoned speech.
let permit: object | null = {}

export function speechPlaybackPermit(): object | null { return permit }

/// Registration is exclusive: a new utterance replaces the previous one, and a
/// player clears its own registration when it releases.
export function registerSpeechPlayback(playback: ActiveSpeechPlayback | null): void {
  if (playback && !permit) { playback.suspend(); return }
  active = playback
}

/** Lifecycle suspension stops the active utterance; returning never resumes it. */
export function setPlaybackAllowed(allowed: boolean): void {
  if (!allowed) { permit = null; active?.suspend() }
  else permit ??= {}
}

export function setVoiceVolume(volume: number): void {
  if (!Number.isFinite(volume) || volume < 0 || volume > 1) throw new Error('Voice volume must be between 0 and 1.')
  if (volume === 0) { active?.suspend(); return }
  active?.setVolume(volume)
}
