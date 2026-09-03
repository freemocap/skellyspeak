import { useEffect, useRef } from 'react'

/// Where the strip gets its samples.
///
/// It used to take an `AnalyserNode` directly, which tied it to the Web Audio
/// API — and therefore to the browser recorder, which a packaged macOS build
/// does not have. Both recorders can produce a list of numbers, so that is the
/// contract, and neither one is privileged.
export interface WaveSource {
  /// Time-domain samples in -1..1, oldest first, since the last call.
  /// Whatever is returned is consumed: the strip owns them afterwards.
  read: () => number[]
  /// How many samples a second `read` produces in total. The device picks the
  /// rate, so this is reported rather than assumed — guessing puts a visible
  /// drift in the time axis on anything that is not running at 48kHz.
  samplesPerSecond: number
}

interface WaveformStripProps {
  source: WaveSource | null
  height?: number
  timelineSeconds?: number
  waveColor?: string
  backgroundColor?: string
}

/// Compact scrolling oscilloscope for the composer — adapted from the
/// mic-waveform-visualizer extract (ultraskelly-ui-og lineage): literal
/// time-domain waveform, bounded history, red "now" line, elapsed timer.
/// Draws only while `source` is present.
export function WaveformStrip({
  source,
  height = 44,
  timelineSeconds = 6,
  waveColor = '#6f9bff',
  backgroundColor = '#0c151f',
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

    const maxSamples = Math.max(1, Math.floor(timelineSeconds * source.samplesPerSecond))

    const resize = () => {
      if (!container) return
      const width = container.clientWidth
      const dpr = window.devicePixelRatio || 1
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)
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

      ctx2d.fillStyle = backgroundColor
      ctx2d.fillRect(0, 0, width, height)

      // center line
      ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.12)'
      ctx2d.lineWidth = 1
      ctx2d.beginPath()
      ctx2d.moveTo(0, height / 2)
      ctx2d.lineTo(width, height / 2)
      ctx2d.stroke()

      // scrolling waveform
      const history = historyRef.current
      if (history.length > 1) {
        const pxPerSample = width / maxSamples
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
      ctx2d.strokeStyle = 'rgba(230, 179, 87, 0.7)'
      ctx2d.lineWidth = 1.5
      ctx2d.beginPath()
      ctx2d.moveTo(width - 1, 0)
      ctx2d.lineTo(width - 1, height)
      ctx2d.stroke()

      // elapsed
      const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000)
      ctx2d.fillStyle = 'rgba(232, 238, 247, 0.55)'
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
  }, [source, height, timelineSeconds, waveColor, backgroundColor])

  return (
    <div ref={containerRef} className="wave-strip">
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%' }} />
    </div>
  )
}
