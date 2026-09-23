import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../components/localization/i18n'
import { errorMessage } from '../../platform/diagnostics/error-details'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import { Spectrogram, SpectrogramFrequencyScale, sharedScale } from '../../components/media/Spectrogram'
import {
  ActivityTrack, DetectionDetails, TimedWordTrack, SegmentMarkers, WordTimingNote, useSeconds,
} from '../../components/media/InspectionTracks'
import { replaySelectionAudio } from '../../platform/audio/reading-speech'
import { useSettingsStore } from '../../state/settings/settings'
import { drillAttemptAudio, inspectDrillAudio } from '../../platform/ipc/drill'
import type { AudioInspection, DrillAttemptView, DrillItemView } from '../../generated/contracts'
import { facts, match } from './AttemptLog'

/** One attempt, measured against the phrase and against the reference reading.
 *
 * Everything shown is something native established: the comparison, the
 * retained bytes, and the analysis of the two recordings. Where a measurement
 * is missing the panel says so rather than leaving a gap that reads as zero. */
export function AttemptInspection({ item, attempt, reference, holding }: {
  item: DrillItemView
  attempt: DrillAttemptView
  reference: AudioInspection | null
  holding: boolean
}) {
  const tr = useI18n()
  const seconds = useSeconds()
  const comparison = attempt.comparison
  const [audio, setAudio] = useState<{ base64: string; inspection: AudioInspection } | null>(null)
  const [failure, setFailure] = useState<unknown>(null)
  const [playing, setPlaying] = useState(false)
  const [retry, setRetry] = useState(0)
  const settings = useSettingsStore(state => state.settings)
  const playback = useRef<AbortController | null>(null)
  useEffect(() => () => { playback.current?.abort(); playback.current = null }, [attempt.id])
  useEffect(() => {
    setAudio(null); setFailure(null)
    if (attempt.audioBytes === null || attempt.audioPrunedAt !== null) return
    let current = true
    void drillAttemptAudio(attempt.id)
      .then(async base64 => { const inspection = await inspectDrillAudio(item.id, base64); if (current) setAudio({ base64, inspection }) })
      .catch(error => { if (current) setFailure(error) })
    return () => { current = false }
  }, [attempt.id, attempt.audioBytes, attempt.audioPrunedAt, item.id, retry])

  const replay = async (base64: string) => {
    if (holding) return
    playback.current?.abort()
    const controller = new AbortController()
    playback.current = controller
    setPlaying(true)
    try {
      await replaySelectionAudio(base64, controller.signal, () => {}, settings?.tts_rate ?? 1,
        (settings?.master_volume ?? 100) * (settings?.voice_volume ?? 100) / 10000)
    } catch (error) {
      if (playback.current === controller && !controller.signal.aborted && !(error instanceof DOMException && error.name === 'AbortError')) setFailure(error)
    } finally { if (playback.current === controller) setPlaying(false) }
  }

  const words = comparison.words
  const exact = words.filter(word => word.kind === 'same').length
  const counted = words.filter(word => word.kind !== 'extra').length
  const recording = attempt.audioPrunedAt !== null ? { value: tr("Removed"), note: tr("Freed by the storage limit. The transcript and comparison remain.") }
    : attempt.audioBytes === null ? { value: tr("Not kept"), note: tr("Storage is set to keep no recordings.") }
    : { value: tr("{value0} kB", { value0: tr.number(Number(attempt.audioBytes) / 1000, { maximumFractionDigits: 0 }) }), note: tr("Kept, and replayable.") }

  // Both panels share one dB window, and the analysis already shares one band
  // grid, so the two pictures can be read against each other.
  const panels = [
    reference && { key: 'reference', label: tr("Reference"), inspection: reference, marks: false },
    audio && { key: 'attempt', label: tr("You"), inspection: audio.inspection, marks: true },
  ].filter(panel => panel !== null)
  const scale = panels.length ? sharedScale(panels.map(panel => panel.inspection.spectrogram)) : null
  const span = Math.max(...panels.map(panel => panel.inspection.duration), 0.001)

  return (
    <section className="drill-inspection" aria-label={tr("Attempt {value0}", { value0: String(attempt.sequence) })}>
      <div className="drill-inspection-head">
        <h2>{tr("Attempt {value0}", { value0: String(attempt.sequence) })}</h2>
        <span className="drill-attempt-when">{tr.dateTime(new Date(attempt.createdAt))}</span>
        {facts(comparison, tr).map(fact => <span key={fact.label} className="drill-chip" data-tone={fact.tone}>{fact.label}</span>)}
        <span className="drill-inspection-spacer" />
        <button type="button" className="btn" disabled={!audio || playing || holding} onClick={() => audio && void replay(audio.base64)}>
          <ToolbarIcon name="play" size={15} />{tr(playing ? "Playing…" : "Play yours")}
        </button>
      </div>

      <dl className="drill-tiles">
        <div className="drill-tile">
          <dt>{tr("Transcript match")}</dt>
          <dd>{match(comparison, tr)}</dd>
          <p>{tr("Characters matching the target, after {value0}", { value0: comparison.normalizations.length ? comparison.normalizations.join(', ') : tr("no normalization") })}</p>
        </div>
        <div className="drill-tile">
          <dt>{tr("Words")}</dt>
          <dd>{tr("{value0}/{value1}", { value0: String(exact), value1: String(counted) })}</dd>
          <p>{tr("Exactly as written")}</p>
        </div>
        <div className="drill-tile">
          <dt>{tr("Length")}</dt>
          <dd>{audio ? seconds(audio.inspection.duration) : tr("—")}</dd>
          <p>{reference ? tr("Reference {value0}", { value0: seconds(reference.duration) })
            : tr("Hear it once to compare lengths")}</p>
        </div>
        <div className="drill-tile">
          <dt>{tr("Recording")}</dt>
          <dd>{recording.value}</dd>
          <p>{recording.note}</p>
        </div>
      </dl>

      <div className="drill-alignment">
        <div className="drill-alignment-labels"><span>{tr("Target")}</span><span>{tr("Heard")}</span></div>
        <ol className="drill-words" aria-label={tr("Word by word")}>
          {words.map((word, index) => {
            const outcome = { same: tr("same"), substituted: tr("letters differ"), missing: tr("not heard"), extra: tr("extra") }[word.kind]
            // Read as one statement: the bare fragments alone say nothing about
            // which column a word came from.
            return (
              <li key={index} data-outcome={word.kind} aria-label={tr("{value0}, heard as {value1}: {value2}", {
                value0: word.target ?? tr("nothing"), value1: word.transcript ?? tr("nothing"), value2: outcome,
              })}>
                <bdi aria-hidden="true">{word.target ?? tr("—")}</bdi>
                <bdi aria-hidden="true">{word.transcript ?? tr("—")}</bdi>
                <span aria-hidden="true">{outcome}</span>
              </li>
            )
          })}
        </ol>
      </div>
      {comparison.scriptNote === 'mismatch' && <p role="note">{tr("The transcript is in a different script from the phrase. This does not change the measurement.")}</p>}

      {/* The summary above is a reading of these numbers, never a replacement
          for them: the measurement the comparison actually produced stays here. */}
      <details className="drill-comparison">
        <summary>{tr("Comparison details")}</summary>
        <dl>
          <dt>{tr("Policy")}</dt><dd>{comparison.policy}</dd>
          <dt>{tr("Character error rate")}</dt>
          <dd>{comparison.characterErrorRate === null ? tr("Not measurable")
            : tr.number(comparison.characterErrorRate, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd>
          <dt>{tr("Edits")}</dt>
          <dd>{tr("{value0} of {value1} characters", { value0: String(comparison.edits), value1: String(comparison.referenceGraphemes) })}</dd>
          <dt>{tr("Normalized before comparing")}</dt>
          <dd>{comparison.normalizations.length ? comparison.normalizations.join(', ') : tr("Nothing")}</dd>
        </dl>
      </details>

      {failure != null && <p role="alert">{errorMessage(failure)}
        <button type="button" className="btn" onClick={() => setRetry(value => value + 1)}>{tr("Try again")}</button></p>}

      {panels.length > 0 && scale && <div className="drill-panels">
        {panels.map(panel => (
          <figure key={panel.key}>
            <figcaption>{panel.label} · {seconds(panel.inspection.duration)}
              {panel.marks && panel.inspection.activity.regions.length > 1
                && tr(" · {value0} speech segments", { value0: String(panel.inspection.activity.regions.length) })}</figcaption>
            <div className="inspection-plot" style={{ width: `${panel.inspection.duration / span * 100}%` }}>
              <Spectrogram data={panel.inspection.spectrogram} duration={panel.inspection.duration} zoom={1} scale={scale} />
              <SpectrogramFrequencyScale data={panel.inspection.spectrogram} />
              {panel.marks && <SegmentMarkers activity={panel.inspection.activity} duration={panel.inspection.duration} />}
            </div>
            <ActivityTrack activity={panel.inspection.activity} duration={panel.inspection.duration} />
            {panel.inspection.wordTiming.status === 'unavailable'
              ? <WordTimingNote wordTiming={panel.inspection.wordTiming} />
              : <TimedWordTrack wordTiming={panel.inspection.wordTiming} duration={panel.inspection.duration} />}
          </figure>
        ))}
        {!reference && <p role="status">{tr("Play the reference to compare it with this attempt.")}</p>}
        {audio && <DetectionDetails activity={audio.inspection.activity} spectrogram={audio.inspection.spectrogram}>
          <p>{tr("This recording is kept until the storage limit removes it.")}</p>
        </DetectionDetails>}
      </div>}
    </section>
  )
}
