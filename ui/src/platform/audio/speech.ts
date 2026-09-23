// Playback authority for synthesized speech: lifecycle suspension and the voice
// volume reach whichever utterance is actually playing. The player registers
// itself here, so this module never creates audio and cannot request speech.
//
// The microphone shares this authority. A recording and playback must never run
// together — the speakers would be recorded — so capture stops whatever is
// playing and refuses new playback until it ends.

export interface ActiveSpeechPlayback {
  /// Release playback and report it finished, so the caller clears its state.
  suspend: () => void
  setVolume: (volume: number) => void
}

const interruptionListeners = new Set<() => void>()
export function onSpeechInterrupted(listener: () => void): () => void {
  interruptionListeners.add(listener)
  return () => { interruptionListeners.delete(listener) }
}
const notifyInterrupted = () => { for (const listener of [...interruptionListeners]) listener() }

let active: ActiveSpeechPlayback | null = null
// A permit is invalidated by suspension even if focus returns before an async
// audio read completes. Returning to the app must never resume abandoned speech.
let permit: object | null = {}

export function speechPlaybackPermit(): object | null { return permit }

// A recording in progress. One at a time, matching the native capture slot.
let capturing: object | null = null
let lifecycleAllowed = true

/** Whether a recording currently holds the microphone. */
export function microphoneHeld(): boolean { return capturing !== null }

/** Claim the microphone: stop anything playing and hold playback off until the
 * recording ends. Returns a token the same recording releases with. */
export function beginCapture(): object {
  if (capturing) throw new Error('A recording is already running.')
  const token = {}
  capturing = token
  active?.suspend()
  permit = null
  notifyInterrupted()
  return token
}

/** Release the microphone. A stale token — a recording that was already
 * replaced — never re-enables playback for the one that followed it. */
export function endCapture(token: object): void {
  if (capturing !== token) return
  capturing = null
  if (lifecycleAllowed) permit ??= {}
}

/// Registration is exclusive: a new utterance replaces the previous one, and a
/// player clears its own registration when it releases.
export function registerSpeechPlayback(playback: ActiveSpeechPlayback | null): void {
  if (playback && !permit) { playback.suspend(); return }
  active = playback
}

/** Lifecycle suspension stops the active utterance; returning never resumes it. */
export function setPlaybackAllowed(allowed: boolean): void {
  lifecycleAllowed = allowed
  if (!allowed) { permit = null; active?.suspend(); notifyInterrupted() }
  // A recording still holds the microphone: the app returning does not hand
  // playback back until that recording ends.
  else if (!capturing) permit ??= {}
}

export function setVoiceVolume(volume: number): void {
  if (!Number.isFinite(volume) || volume < 0 || volume > 1) throw new Error('Voice volume must be between 0 and 1.')
  if (volume === 0) { interruptSpeech(); return }
  active?.setVolume(volume)
}

/** Explicit new speech invalidates pending playback as well as the active audio.
 * It is refused outright while a recording holds the microphone. */
export function interruptSpeech(): object | null {
  if (capturing) return null
  active?.suspend()
  if (permit) permit = {}
  notifyInterrupted()
  return permit
}
