import { useEffect, useRef, useState } from 'react'
import type { AudioInspection } from '../../../generated/contracts'
import { CompactInspection } from '../../../components/media/CompactInspection'
import { useAudibleScrub } from '../../../components/media/useAudibleScrub'
import { ErrorNotice } from '../../../components/feedback/ErrorNotice'
import { useI18n } from '../../../components/localization/i18n'
import { inspectMessageSpeech, peekMessageInspection } from '../../../platform/ipc/message-speech'
import { TranscriptionInspector } from './TranscriptionInspector'
import type { MessageAudio } from './useMessageSpeech'

export interface MessageSpeechPlayback {
  retained: MessageAudio | null
  time: number
  playing: boolean
  enabled: boolean
  rate: number
  volume: number
  seek: (seconds: number) => void
  stop: () => void
  toggle: () => void
}

/** Only binds the reply's retained operation to the shared recording views. */
export function MessageSpeechInspection({ speech, text, open = true }: { speech: MessageSpeechPlayback; text: string; open?: boolean }) {
  const tr = useI18n()
  const [inspection, setInspection] = useState<AudioInspection | null>(null)
  const [failure, setFailure] = useState<unknown>(null)
  const [retry, setRetry] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const sessionId = speech.retained?.sessionId
  const operationId = speech.retained?.audio.operationId
  const attemptId = speech.retained?.audio.attemptId
  const requested = useRef(false)
  if (open) requested.current = true
  const requestedOnce = requested.current
  const cached = speech.retained ? peekMessageInspection(speech.retained.sessionId, speech.retained.audio) : null
  useEffect(() => {
    setInspection(null); setFailure(null)
    if (!requestedOnce || !speech.retained) return
    let current = true
    void inspectMessageSpeech(speech.retained.sessionId, speech.retained.audio)
      .then(value => { if (current) setInspection(value) })
      .catch(error => { if (current) setFailure(error) })
    return () => { current = false }
  }, [sessionId, operationId, attemptId, retry, requestedOnce])
  const scrub = useAudibleScrub(speech.retained?.audio.audioBase64 ?? null, speech.enabled, speech.playing,
    speech.volume, setFailure, speech.stop, { text, alignment: speech.retained?.audio.alignment })
  const playback = { time: speech.time, playing: speech.playing, toggle: speech.toggle, seek: speech.seek, scrub }
  const shown = cached ?? inspection
  return <div hidden={!open}>
    {failure != null ? <ErrorNotice as="div" error={failure}>{tr('Audio playback failed.')}
      <button type="button" className="btn" onClick={() => setRetry(value => value + 1)}>{tr('Try again')}</button>
    </ErrorNotice> : shown ? <CompactInspection inspection={shown} playback={playback} enabled={speech.enabled}
      onExpand={() => setExpanded(true)} /> : <p role="status">{tr(speech.retained || speech.playing ? 'Loading…' : 'Recording audio unavailable.')}</p>}
    {open && expanded && shown && speech.retained && <TranscriptionInspector
      result={{ text, inspection: shown, audioBase64: speech.retained.audio.audioBase64, diagnostics: null }}
      rate={speech.rate} volume={speech.volume} enabled={speech.enabled} playback={playback} onClose={() => setExpanded(false)} />}
  </div>
}
