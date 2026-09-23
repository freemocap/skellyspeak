import type { ListeningTake, LiveSpectrogram } from '../../generated/contracts'
import type { WaveSource } from '../../domain/audio/waveform'
import { useI18n } from '../localization/i18n'
import { Spectrogram, SpectrogramFrequencyScale } from './Spectrogram'
import { WaveformStrip } from './WaveformStrip'

/** Native audio bounds on one shared clock; decoration cannot create a cut. */
export function LiveRecording({ source, spectrum, takes, active = true }: {
  active?: boolean
  source: WaveSource | null; spectrum: LiveSpectrogram | null; takes: ListeningTake[]
}) {
  const tr = useI18n()
  const seconds = 12
  const end = spectrum?.endSeconds ?? 0
  const latest = takes.at(-1)
  return <div className="live-recording">
    <div className="live-recording-head"><span>{tr(active ? 'Microphone · live' : 'Recording timeline')}</span>
      {latest && <span key={latest.recordingId} className="live-cut-notice" role="status">{tr('Take {value0} clipped →', { value0: latest.number })}</span>}
    </div>
    <div className="live-recording-plots">
      <WaveformStrip source={source} height={48} timelineSeconds={seconds} endSeconds={spectrum?.endSeconds} />
      {spectrum && <div className="inspection-plot">
        <Spectrogram data={spectrum.data} duration={seconds} startSeconds={end - seconds} zoom={1} />
        <SpectrogramFrequencyScale data={spectrum.data} />
      </div>}
      {takes.filter(take => take.endSeconds >= end - seconds && take.startSeconds <= end).map(take => {
        const left = Math.max(0, (take.startSeconds - end + seconds) / seconds * 100)
        const right = Math.min(100, (take.endSeconds - end + seconds) / seconds * 100)
        return <div key={take.recordingId} className="live-take-region" style={{ left: `${left}%`, width: `${Math.max(0, right - left)}%` }}>
          <span>{tr('Take {value0}', { value0: take.number })}</span>
        </div>
      })}
    </div>
    <div className="live-recording-axis"><span>{tr('Last {value0} seconds', { value0: seconds })}</span><span>{tr('Now')}</span></div>
  </div>
}
