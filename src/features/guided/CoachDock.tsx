import { useEffect, useRef, useState, type ReactNode } from 'react'

const STORAGE_KEY = 'skellyspeak_coach_layout'
const MIN_HEIGHT = 64
const MIN_EXPANDED_HEIGHT = 160
const DEFAULT_HEIGHT = 160
type Layout = { height: number; collapsed: boolean }

function readLayout(): Layout {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === null) return { height: DEFAULT_HEIGHT, collapsed: true }
  const layout: unknown = JSON.parse(stored)
  if (typeof layout !== 'object' || layout === null || !('height' in layout) ||
      typeof layout.height !== 'number' || !Number.isFinite(layout.height) || layout.height < MIN_EXPANDED_HEIGHT ||
      !('collapsed' in layout) || typeof layout.collapsed !== 'boolean') {
    throw new Error('Invalid saved coach panel layout.')
  }
  return { height: layout.height, collapsed: layout.collapsed }
}

type CoachDockProps = { children: ReactNode; actions: ReactNode; presentation?: 'dock' | 'dialog' }

export function CoachDock({ presentation = 'dock', children, actions }: CoachDockProps) {
  if (presentation === 'dialog') return <section className="coach-dock is-dialog" aria-label="Coach panel">
    <div className="coach-thread-head"><span>Talk to your coach</span>{actions}</div>
    {children}
  </section>
  return <ResizableCoachDock actions={actions}>{children}</ResizableCoachDock>
}

function ResizableCoachDock({ children, actions }: CoachDockProps) {
  const [layout, setLayout] = useState<Layout>(readLayout)
  const dock = useRef<HTMLElement>(null)
  const drag = useRef<{ y: number; height: number } | null>(null)
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)) }, [layout])
  const resize = (height: number): void => {
    const parent = dock.current?.parentElement
    if (!parent) throw new Error('Coach panel has no layout container.')
    const maximum = Math.max(MIN_EXPANDED_HEIGHT, parent.getBoundingClientRect().height - 120)
    const collapsed = height <= MIN_HEIGHT
    const bounded = Math.round(Math.max(MIN_EXPANDED_HEIGHT, Math.min(maximum, height)))
    setLayout((previous) => ({ height: collapsed ? previous.height : bounded, collapsed }))
  }
  return <section ref={dock} className={`coach-dock ${layout.collapsed ? 'is-collapsed' : ''}`}
    style={{ height: layout.collapsed ? MIN_HEIGHT : layout.height }} aria-label="Coach panel" onFocusCapture={event => { if (event.target instanceof HTMLTextAreaElement) setLayout(previous => ({ ...previous, collapsed: false })) }}>
    <div className="coach-resizer" role="separator" tabIndex={0} aria-label="Resize coach panel"
      aria-orientation="horizontal" aria-valuemin={MIN_HEIGHT} aria-valuenow={layout.collapsed ? MIN_HEIGHT : layout.height}
      aria-valuetext={layout.collapsed ? 'Collapsed' : `${layout.height} pixels`}
      title="Drag to resize. Arrow Up or Down adjusts height; Enter collapses or expands."
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        event.currentTarget.focus()
        event.currentTarget.setPointerCapture(event.pointerId)
        drag.current = { y: event.clientY, height: dock.current!.getBoundingClientRect().height }
      }}
      onPointerMove={(event) => { if (drag.current) resize(drag.current.height + drag.current.y - event.clientY) }}
      onPointerUp={(event) => {
        drag.current = null
        event.currentTarget.releasePointerCapture(event.pointerId)
      }}
      onPointerCancel={() => { drag.current = null }}
      onLostPointerCapture={() => { drag.current = null }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault()
          resize(event.key === 'ArrowDown' && !layout.collapsed && layout.height <= MIN_EXPANDED_HEIGHT
            ? MIN_HEIGHT : (layout.collapsed ? MIN_HEIGHT : layout.height) + (event.key === 'ArrowUp' ? 24 : -24))
        } else if (event.key === 'Enter') {
          event.preventDefault()
          setLayout((previous) => ({ ...previous, collapsed: !previous.collapsed }))
        }
      }} />
    <div className="coach-thread-head">
      <button type="button" className="coach-collapse" aria-label={layout.collapsed ? 'Expand coach thread' : 'Collapse coach thread'}
        aria-expanded={!layout.collapsed} onClick={() => setLayout((previous) => ({ ...previous, collapsed: !previous.collapsed }))}>
        {layout.collapsed ? '▸' : '▾'} Talk to your coach
      </button>
      {actions}
    </div>
    {children}
  </section>
}
