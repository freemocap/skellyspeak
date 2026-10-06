import { useI18n } from '../localization/i18n'
import type { MicrophoneHealth } from '../../domain/audio/microphone-health'

export function MicrophoneSignal({ health, showMeter = true }: { health: MicrophoneHealth | null; showMeter?: boolean }) {
  const tr = useI18n()
  return <div>
    {showMeter && <meter min={0} max={1} value={health?.level ?? 0} aria-label={tr('Microphone level')} />}
    <p role="status" className="field-note">{health?.signal === 'stalled'
      ? tr('The microphone stopped sending audio. Check its connection.')
      : health?.signal === 'quiet'
        ? tr('Very little sound is reaching this microphone. Check mute or move closer.')
        : health?.detected ? tr('Sound detected') : tr('Say something to check the input.')}</p>
  </div>
}

