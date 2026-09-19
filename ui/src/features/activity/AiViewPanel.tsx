import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from '../../components/localization/i18n'
import { useIsMobile } from '../../components/layout/useIsMobile'
import { openOverlay } from '../../domain/input/back'
import { DetailDialog } from '../../components/dialogs/DetailDialog'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import { reportFault } from '../../platform/diagnostics/faults'
import { openAiWindow } from '../../platform/ipc/window'
import { useAiWindowStore } from '../../state/navigation/ai-window'
import { AiView } from './AiView'

// The docked AI View: a resizable sheet pulled up from the bottom of the app,
// which can fill the window or move into its own desktop window.
const HEIGHT_KEY = 'skellyspeak_dev_h'
const MIN_VH = 18
// The panel pushes the app up rather than covering it, so the ceiling has to
// leave a usable conversation behind it.
const MAX_VH = 80
const DEFAULT_VH = 40

function storedHeight(): number {
  const raw = Number(localStorage.getItem(HEIGHT_KEY))
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_VH
  // Persisted heights are clamped to the layout's usable range.
  return Math.min(MAX_VH, Math.max(MIN_VH, raw))
}

interface AiViewPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AiViewPanel({ open, onOpenChange }: AiViewPanelProps) {
  const tr = useI18n()
  const [heightVh, setHeightVh] = useState<number>(storedHeight)
  const [expanded, setExpanded] = useState(false)
  const isMobile = useIsMobile()
  const dragging = useRef(false)
  const windowSupported = useAiWindowStore(state => state.supported)
  const refreshWindow = useAiWindowStore(state => state.refresh)

  // Android back restores an expanded panel first, then closes it.
  useEffect(() => (open && !isMobile ? openOverlay(() => expanded ? setExpanded(false) : onOpenChange(false)) : undefined), [open, onOpenChange, isMobile, expanded])
  useEffect(() => { if (!open) setExpanded(false) }, [open])
  useEffect(() => {
    if (!expanded) return
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); setExpanded(false) } }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  }, [expanded])

  // Drag the top edge. Pointer events (not mouse) so a trackpad, a pen and a
  // touch screen all behave the same.
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    dragging.current = true
    const move = (ev: PointerEvent) => {
      if (!dragging.current) return
      const vh = ((window.innerHeight - ev.clientY) / window.innerHeight) * 100
      const clamped = Math.min(MAX_VH, Math.max(MIN_VH, vh))
      setHeightVh(clamped)
    }
    const up = () => {
      dragging.current = false
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setHeightVh((h) => {
        localStorage.setItem(HEIGHT_KEY, String(Math.round(h)))
        return h
      })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }, [])

  const popOut = () => {
    openAiWindow()
      .then(() => { onOpenChange(false); return refreshWindow() })
      .catch(error => reportFault('Opening the AI window', error))
  }

  if (isMobile) return open ? <DetailDialog title={tr("AI activity")} size="wide" onClose={() => onOpenChange(false)}><div className="mobile-ai-panel"><AiView mode="expanded" actions={null} /></div></DetailDialog> : null
  if (!open) return null

  const actions = <>
    <button type="button" className="ai-icon-button" onClick={() => setExpanded(!expanded)} aria-pressed={expanded}
      aria-label={expanded ? tr('Restore to bottom panel') : tr('Expand to full window')} title={expanded ? tr('Restore to bottom panel') : tr('Expand to full window')}>
      <ToolbarIcon name={expanded ? 'collapse' : 'expand'} size={15} />
    </button>
    {windowSupported && <button type="button" className="ai-icon-button" onClick={popOut} aria-label={tr('Pop out into its own window')} title={tr('Pop out into its own window')}>
      <ToolbarIcon name="popout" size={15} />
    </button>}
    <button type="button" className="ai-icon-button" onClick={() => onOpenChange(false)} aria-label={tr('Close AI activity')} title={tr('Close AI activity')}>
      <ToolbarIcon name="close" size={15} />
    </button>
  </>

  return <div id="ai-activity" className={expanded ? 'logs-panel ai-panel-expanded' : 'logs-panel'} style={expanded ? undefined : { height: `${heightVh}dvh` }}>
    {!expanded && <div className="logs-resize" onPointerDown={onPointerDown} role="separator" aria-label={tr("Resize panel")} title={tr("Drag to resize")} />}
    <AiView mode={expanded ? 'expanded' : 'docked'} actions={actions} />
  </div>
}
