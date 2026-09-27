import { scrubTime } from '../../domain/audio/scrub-segment'
import { useRef, type PointerEvent } from 'react'

/** Scrubbing uses original audio time, including while the visual warp animates. */
export function PlaybackCursor({ time, duration, displayDuration = duration, mapTime, direction, label, onSeek, onScrubStart, onScrub, onScrubEnd }: {
  time: number; duration: number; displayDuration?: number; mapTime?: ((time: number) => number) | null
  onScrubStart?: (seconds: number, timestamp?: number) => void
  onScrub?: (seconds: number, timestamp?: number) => void; onScrubEnd?: () => void
  direction: 'ltr' | 'rtl'; label: string; onSeek?: (seconds: number) => void
}) {
  const dragging = useRef(false)
  const end = () => { if (dragging.current) { dragging.current = false; onScrubEnd?.() } }
  const position = (mapTime ? mapTime(time) : time) / displayDuration
  const seek = (event: PointerEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.parentElement!.getBoundingClientRect()
    let fraction = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width))
    if (direction === 'rtl') fraction = 1 - fraction
    const time = scrubTime(fraction, duration, displayDuration, mapTime)
    onSeek?.(time)
    return time
  }
  return <button type="button" className="drill-playback-cursor" role="slider" aria-label={label}
    aria-valuemin={0} aria-valuemax={duration} aria-valuenow={Math.max(0, Math.min(duration, time))}
    disabled={!onSeek}
    onPointerDown={event => { dragging.current = true; event.currentTarget.setPointerCapture(event.pointerId); const time = seek(event); onScrubStart?.(time, event.timeStamp) }}
    onPointerMove={event => { if (dragging.current && event.currentTarget.hasPointerCapture(event.pointerId)) { const time = seek(event); onScrub?.(time, event.timeStamp) } }}
    onPointerCancel={end} onLostPointerCapture={end} onBlur={end}
    onPointerUp={event => { end(); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
    onKeyDown={event => {
      const delta = direction === 'rtl' ? -0.1 : 0.1
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? duration
        : event.key === 'ArrowRight' ? time + delta : event.key === 'ArrowLeft' ? time - delta : null
      if (next !== null) { event.preventDefault(); onSeek?.(Math.max(0, Math.min(duration, next))) }
    }}><span className="audio-spectrum-cursor" style={{ left: `${Math.max(0, Math.min(1, position)) * 100}%` }} aria-hidden="true" /></button>
}
