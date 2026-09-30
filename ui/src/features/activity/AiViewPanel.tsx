import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../components/localization/i18n'
import { useIsMobile } from '../../components/layout/useIsMobile'
import { ResizeHandle, useStoredSize } from '../../components/layout/ResizeHandle'
import { openOverlay } from '../../domain/input/back'
import { DetailDialog } from '../../components/dialogs/DetailDialog'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import { reportFault } from '../../platform/diagnostics/faults'
import { openAiWindow } from '../../platform/ipc/window'
import { useAiWindowStore } from '../../state/navigation/ai-window'
import { useAiTrayStore } from '../../state/navigation/ai-tray'
import { useNavigationStore } from '../../state/navigation/navigation'
import { AiView } from './AiView'

// The docked AI View: a resizable sheet pulled up from the bottom of the app,
// which can fill the window or move into its own desktop window. On phones it
// opens as a tray above the recording panel, which can fill the screen.
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
  const isMobile = useIsMobile()
  // Where the phone's tray goes: above the recording panel of the page showing one.
  const slot = useAiTrayStore(state => state.slot)
  const inspecting = useNavigationStore(state => state.aiInspection !== null)
  // Desktop: the dock filling the window. Phones: the full screen, not the tray,
  // which is where a phone opens it unless no recording panel shows.
  const [expanded, setExpanded] = useState(() => open && isMobile && !slot)
  const [shownOpen, setShownOpen] = useState(open)
  if (shownOpen !== open) {
    setShownOpen(open)
    setExpanded(open && isMobile && !slot)
  }
  // Inspecting a named operation, from an error, reply help or an explanation,
  // is reading its details, and can start from the coach, which covers the
  // recording panel: on phones it takes the full screen.
  if (open && isMobile && inspecting && !expanded) setExpanded(true)
  // The tray leaves with its recording panel rather than jumping to the full screen.
  const stranded = open && isMobile && !expanded && !slot
  useEffect(() => { if (stranded && !useAiTrayStore.getState().slot) onOpenChange(false) }, [stranded, onOpenChange])
  const dragging = useRef(false)
  const windowSupported = useAiWindowStore(state => state.supported)
  const refreshWindow = useAiWindowStore(state => state.refresh)
  const tray = useRef<HTMLDivElement>(null)
  const [trayHeight, setTrayHeight] = useStoredSize('ai-tray')

  // Android back: on desktop an expanded panel restores first, then closes. The
  // phone's tray closes; its full screen is a dialog, which handles Back itself.
  useEffect(() => {
    if (!open) return undefined
    if (!isMobile) return openOverlay(() => expanded ? setExpanded(false) : onOpenChange(false))
    return expanded ? undefined : openOverlay(() => onOpenChange(false))
  }, [open, onOpenChange, isMobile, expanded])
  useEffect(() => {
    if (!expanded || isMobile) return
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); setExpanded(false) } }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  }, [expanded, isMobile])

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

  // Phones: the tray, with a grip on its top edge, rises above the recording
  // panel and leaves it in view while the learner records or sends; it expands
  // to the full screen and restores. Both carry their controls in the view's
  // own header. Back, Escape and the close control close the full screen too,
  // since the tray could be hidden under the coach.
  if (isMobile) {
    if (!open || stranded) return null
    const restoreLabel = expanded ? tr('Restore above the recording panel') : tr('Expand to full window')
    const phoneActions = <>
      {slot && <button type="button" className="ai-icon-button" onClick={() => setExpanded(!expanded)} aria-pressed={expanded} aria-label={restoreLabel} title={restoreLabel}>
        <ToolbarIcon name={expanded ? 'collapse' : 'expand'} size={15} />
      </button>}
      <button type="button" className="ai-icon-button" onClick={() => onOpenChange(false)} aria-label={tr('Close AI activity')} title={tr('Close AI activity')}>
        <ToolbarIcon name="close" size={15} />
      </button>
    </>
    if (!expanded && slot) return createPortal(<div ref={tray} className="ai-tray" style={trayHeight === null ? undefined : { '--ai-tray-height': `${Math.round(trayHeight)}px` } as CSSProperties}>
      <ResizeHandle className="ai-tray-resize" label={tr("Resize panel")} axis="y" grow={-1} size={trayHeight} min={140} max={Math.round(window.innerHeight * 0.7)}
        measure={() => tray.current?.getBoundingClientRect().height ?? 0} onResize={setTrayHeight} />
      <AiView mode="tray" actions={phoneActions} />
    </div>, slot)
    return <DetailDialog capture="preserve" title={tr("AI activity")} placement="full" closeControl="content" className="ai-screen" onClose={() => onOpenChange(false)}>
      <AiView mode="screen" actions={phoneActions} />
    </DetailDialog>
  }
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
