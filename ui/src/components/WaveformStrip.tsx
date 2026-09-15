import { useEffect, useRef } from 'react'
import type { WaveSource } from '../domain/audio/waveform'
import { cssToken } from '../platform/css-token'

interface WaveformStripProps {
  source: WaveSource | null
  height?: number
  timelineSeconds?: number
}

/// Compact scrolling oscilloscope for the composer — adapted from the
/// mic-waveform-visualizer extract (ultraskelly-ui-og lineage): literal
/// time-domain waveform, bounded history, red "now" line, elapsed timer.
/// Draws only while `source` is present.
export function WaveformStrip({
  source,
  height = 44,
  timelineSeconds = 6,
}: WaveformStripProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const historyRef = useRef<number[]>([])
  const startedAtRef = useRef<number>(Date.now())

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || !source) return

    const ctx2d = canvas.getContext('2d')
    if (!ctx2d) return

    // A canvas cannot read var(), so the colours are resolved from the design
    // tokens once per source; opacity is a drawing parameter, not a colour.
    const backgroundColor = cssToken('--shell-sunken')
    const waveColor = cssToken('--accent')
    const gridColor = cssToken('--ink-on-fill')
    const nowColor = cssToken('--warning')
    const labelColor = cssToken('--shell-text')

    const maxSamples = Math.max(1, Math.floor(timelineSeconds * source.samplesPerSecond))

    let needsPaint = true
    let paintedElapsed = -1
    const resize = () => {
      if (!container) return
      const width = container.clientWidth
      const dpr = window.devicePixelRatio || 1
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)
      needsPaint = true
    }
    resize()
    historyRef.current = []
    startedAtRef.current = Date.now()

    const draw = () => {
      if (!container) return
      const width = container.clientWidth

      const incoming = source.read()
      if (incoming.length > 0) {
        historyRef.current = historyRef.current.concat(incoming)
        if (historyRef.current.length > maxSamples) {
          historyRef.current = historyRef.current.slice(-maxSamples)
        }
      }

      const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000)
      // Sample positions only change when data arrives; identical frames add no motion.
      // Keep polling, but repaint for new data, elapsed text, or a cleared/resized canvas.
      if (!needsPaint && incoming.length === 0 && elapsed === paintedElapsed) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }
      needsPaint = false
      paintedElapsed = elapsed

      ctx2d.globalAlpha = 1
      ctx2d.fillStyle = backgroundColor
      ctx2d.fillRect(0, 0, width, height)

      // center line
      ctx2d.globalAlpha = 0.12
      ctx2d.strokeStyle = gridColor
      ctx2d.lineWidth = 1
      ctx2d.beginPath()
      ctx2d.moveTo(0, height / 2)
      ctx2d.lineTo(width, height / 2)
      ctx2d.stroke()

      // scrolling waveform
      const history = historyRef.current
      if (history.length > 1) {
        const pxPerSample = width / maxSamples
        ctx2d.globalAlpha = 1
        ctx2d.strokeStyle = waveColor
        ctx2d.lineWidth = 1.5
        ctx2d.beginPath()
        for (let i = 0; i < history.length; i++) {
          const x = width - (history.length - i) * pxPerSample
          const y = height / 2 - (history[i] ?? 0) * height * 0.45
          if (i === 0) ctx2d.moveTo(x, y)
          else ctx2d.lineTo(x, y)
        }
        ctx2d.stroke()
      }

      // "now" edge
      ctx2d.globalAlpha = 0.7
      ctx2d.strokeStyle = nowColor
      ctx2d.lineWidth = 1.5
      ctx2d.beginPath()
      ctx2d.moveTo(width - 1, 0)
      ctx2d.lineTo(width - 1, height)
      ctx2d.stroke()

      // elapsed
      ctx2d.globalAlpha = 0.55
      ctx2d.fillStyle = labelColor
      ctx2d.font = '9px monospace'
      ctx2d.fillText(`● rec ${elapsed}s`, 6, 12)

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()
    window.addEventListener('resize', resize)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      window.removeEventListener('resize', resize)
      historyRef.current = []
    }
  }, [source, height, timelineSeconds])

  return (
    <div ref={containerRef} className="wave-strip">
      <canvas ref={canvasRef} />
    </div>
  )
}
