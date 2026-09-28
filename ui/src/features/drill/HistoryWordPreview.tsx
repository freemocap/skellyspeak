import { useI18n } from '../../components/localization/i18n'
import { useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { WordOutcome } from '../../generated/contracts'

export interface HoveredHistoryWord { anchor: HTMLElement; word: string; attempt?: string | null; outcome?: WordOutcome }

/** Expand the source cell in place, bounded by the report and viewport. */
export function HistoryWordPreview({ value, onClose }: { value: HoveredHistoryWord; onClose: () => void }) {
  const tr = useI18n()
  const element = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const preview = element.current
    if (!preview) return
    if (!value.anchor.isConnected) { onClose(); return }
    const cell = value.anchor.getBoundingClientRect()
    const row = value.anchor.closest('.drill-word-row')!.getBoundingClientRect()
    const left = Math.max(0, row.left), right = Math.min(window.innerWidth, row.right)
    preview.style.maxWidth = `${Math.max(0, right - left)}px`
    preview.style.minWidth = `${Math.min(cell.width, right - left)}px`
    const bounds = preview.getBoundingClientRect()
    preview.style.left = `${Math.max(left, Math.min(cell.left, right - bounds.width))}px`
    preview.style.top = `${Math.max(0, Math.min(cell.top, window.innerHeight - bounds.height))}px`
    const dismiss = () => onClose()
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('scroll', dismiss, true)
    window.addEventListener('resize', dismiss)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('scroll', dismiss, true)
      window.removeEventListener('resize', dismiss)
      window.removeEventListener('keydown', key)
    }
  }, [value, onClose])
  return createPortal(<span ref={element} className="drill-word-preview" data-outcome={value.outcome} aria-hidden="true"><span className="drill-word-preview-label">{tr("Card")}</span><bdi>{value.word}</bdi>{value.attempt != null && <><span className="drill-word-preview-label">{tr("Attempt")}</span><bdi>{value.attempt}</bdi></>}</span>, document.body)
}
