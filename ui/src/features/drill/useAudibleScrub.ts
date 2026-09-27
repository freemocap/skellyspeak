import { useEffect, useRef } from 'react'
import { createScrubPlayer } from '../../platform/audio/scrub-player'

/** Drag preview uses one sample-controlled player and always stops on release. */
export function useAudibleScrub(audio: string | null, enabled: boolean, _playing: boolean,
  volume: number, onError: (error: unknown) => void, onPause?: () => void) {
  const player = useRef<ReturnType<typeof createScrubPlayer> | null>(null)
  const beganPlaying = useRef<boolean | null>(null)
  const report = useRef(onError)
  report.current = onError
  useEffect(() => {
    if (!audio || !enabled) return
    const current = createScrubPlayer(audio, error => report.current(error))
    player.current = current
    return () => { current.dispose(); if (player.current === current) player.current = null; beganPlaying.current = null }
  }, [audio, enabled])
  useEffect(() => { player.current?.setVolume(volume) }, [volume, audio, enabled])
  return {
    start: (time: number, timestamp?: number) => {
      // Take over even when transport playback was already running: holding
      // the pointer still must not leave that independent clock advancing.
      onPause?.()
      beganPlaying.current = false
      player.current?.start(time, timestamp)
    },
    move: (time: number, timestamp?: number) => {
      if (beganPlaying.current === false) player.current?.move(time, timestamp)
    },
    end: () => {
      player.current?.end()
      if (beganPlaying.current !== null) onPause?.()
      beganPlaying.current = null
    },
  }
}
