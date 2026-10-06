import type { CSSProperties } from 'react'
import { useI18n } from '../localization/i18n'
import type { MicrophoneHealth } from '../../domain/audio/microphone-health'
import type { MicrophonePresence } from '../../platform/audio/useMicrophonePresence'
import type { VoicePhase } from './VoicePanel'

/** What the lamp's dot says: grey at rest, green and glowing with the level
 * while sound arrives, amber for sustained silence, red when samples stop or
 * the saved device is gone. */
export type LampTone = 'idle' | 'live' | 'quiet' | 'stalled' | 'missing'

/** The recorder's microphone lamp: a dot and the word Mic, as quiet as the
 * other row controls. A live recording outranks the device list, which can
 * lag an unplug or a reconnect. The words live in the button's name and
 * tooltip, so the row never grows; problems are announced as well. Pressing
 * it opens Recording settings, where the picker and the check live. */
export function MicrophoneLamp({ phase, health, presence, deviceLabel = null, onOpen }: {
  phase: VoicePhase
  health: MicrophoneHealth | null
  presence: MicrophonePresence | null
  /** The device the recording actually opened, when the platform names it. */
  deviceLabel?: string | null
  onOpen: () => void
}) {
  const tr = useI18n()
  const live = phase === 'recording' && health !== null
  const tone: LampTone = live
    ? health.signal === 'stalled' ? 'stalled' : health.signal === 'quiet' ? 'quiet' : 'live'
    : presence?.state === 'missing' ? 'missing' : 'idle'
  const name = (live ? deviceLabel : null) ?? presence?.label ?? null
  const sentence = {
    idle: name ? tr('Microphone: {name}', { name }) : tr('Microphone'),
    live: health?.detected ? tr('Sound detected') : tr('Listening'),
    quiet: tr('Very little sound is reaching this microphone. Check mute or move closer.'),
    stalled: tr('The microphone stopped sending audio. Check its connection.'),
    missing: tr('This microphone is not connected. Choose another in Recording settings.'),
  }[tone]
  const word = { idle: tr('Mic'), live: tr('Mic'), quiet: tr('Quiet'), stalled: tr('Stopped'), missing: tr('Not connected') }[tone]
  const title = [tone === 'idle' ? null : name, sentence, presence?.detail ?? null].filter(Boolean).join(' · ')
  const problem = tone === 'quiet' || tone === 'stalled' || tone === 'missing'
  return <span className="voice-lamp" data-tone={tone}>
    <button type="button" className="voice-lamp-pill" aria-label={sentence} title={title} aria-haspopup="dialog" onClick={onOpen}
      style={{ '--lamp-level': live ? health.level : 0 } as CSSProperties}>
      <span className="voice-lamp-word" aria-hidden="true">{word}</span>
    </button>
    <span className="voice-lamp-announce" aria-live="polite">{problem ? sentence : ''}</span>
  </span>
}
