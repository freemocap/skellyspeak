import { useEffect, useRef, useState } from 'react'
import { replaySelectionAudio } from '../../platform/audio/reading-speech'
import type { PlaybackHandle } from '../../platform/audio/speech-player'
import { useAudibleScrub, type AudibleScrub } from './useAudibleScrub'

/** One retained recording's transport: play from the current position, stop,
 * seek, and audible scrubbing. Every surface that plays back a recording it
 * shows (Practice's attempt, Chat's recordings) uses this, so they share the
 * speech exclusion, voice speed and volume, and the scrub player. */
export interface RecordingPlayback {
  time: number
  playing: boolean
  toggle: () => void
  seek: (seconds: number) => void
  scrub: AudibleScrub
}

export function useRecordingPlayback({ audio, duration, enabled, rate, volume, onError }: {
  /** The recording as base64 WAV, or null while there is none to play. */
  audio: string | null
  duration: number
  /** False while playback must wait (for example, an attempt is being stored). */
  enabled: boolean
  rate: number
  volume: number
  onError: (error: unknown) => void
}): RecordingPlayback {
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const playback = useRef<AbortController | null>(null)
  const player = useRef<PlaybackHandle | null>(null)
  const report = useRef(onError)
  report.current = onError

  useEffect(() => {
    setTime(0); setPlaying(false)
    return () => { playback.current?.abort(); playback.current = null; player.current = null }
  }, [audio, enabled])

  useEffect(() => { player.current?.setRate(rate) }, [rate])
  useEffect(() => { player.current?.setVolume(volume) }, [volume])

  const stop = () => { playback.current?.abort(); setPlaying(false) }

  const play = async (base64: string, startSeconds: number) => {
    playback.current?.abort()
    const controller = new AbortController()
    playback.current = controller
    setPlaying(true); setTime(startSeconds)
    try {
      await replaySelectionAudio(base64, controller.signal, () => {}, rate, volume, {
        startSeconds,
        onReady: handle => { if (playback.current === controller) player.current = handle },
        onTime: seconds => { if (playback.current === controller && !controller.signal.aborted) setTime(seconds) },
      })
    } catch (error) {
      if (playback.current === controller && !controller.signal.aborted && !(error instanceof DOMException && error.name === 'AbortError')) report.current(error)
    } finally { if (playback.current === controller) setPlaying(false) }
  }

  const scrub = useAudibleScrub(audio, enabled, playing, volume, error => report.current(error), stop)

  return {
    time,
    playing,
    toggle: () => {
      if (playing) { stop(); return }
      if (!audio || !enabled) return
      void play(audio, time < duration ? time : 0)
    },
    seek: seconds => {
      if (!audio || !enabled) return
      setTime(seconds)
      if (playing) player.current?.seek(seconds)
    },
    scrub,
  }
}
