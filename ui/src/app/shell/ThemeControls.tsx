import { useRef, useState, type RefObject } from 'react'
import { useI18n } from '../../components/localization/i18n'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import { useOverlayLayer } from '../../components/dialogs/useOverlayLayer'
import { useSettingsStore } from '../../state/settings/settings'
import { DEFAULT_APPEARANCE, type SurfacePalette } from '../../generated/contracts'

/** The theme switch in the top bar, where there is room for it: the sun/moon
 * toggles light and dark, and the small arrow beside it picks Cool or Warm.
 * They write the same learner preferences as Settings › Appearance. A System
 * theme shows as whichever theme is showing now; switching sets the other one. */
export function ThemeControls() {
  const tr = useI18n()
  const settings = useSettingsStore(state => state.settings)
  const update = useSettingsStore(state => state.update)
  const [menuOpen, setMenuOpen] = useState(false)
  const anchor = useRef<HTMLDivElement>(null)
  if (!settings) return null
  const theme = settings.theme ?? 'light'
  const shownDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const palette = (settings.appearance ?? DEFAULT_APPEARANCE).palette
  const choose = (next: SurfacePalette): void => {
    setMenuOpen(false)
    void update(current => ({ ...current, appearance: { ...(current.appearance ?? DEFAULT_APPEARANCE), palette: next } }), 'Changing palette')
  }
  return <div ref={anchor} className="topbar-theme">
    <button type="button" className="topbar-theme-toggle" aria-pressed={shownDark} aria-label={tr('Dark theme')} title={tr('Dark theme')}
      onClick={() => void update(current => ({ ...current, theme: shownDark ? 'light' : 'dark' }), 'Changing theme')}>
      <ToolbarIcon name={shownDark ? 'moon' : 'sun'} />
    </button>
    <button type="button" className="topbar-theme-more" aria-label={tr('Surface palette')} title={tr('Surface palette')}
      aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(open => !open)}>
      <ToolbarIcon name="chevron" size={12} />
    </button>
    {menuOpen && <PaletteMenu anchor={anchor} palette={palette} onChoose={choose} onClose={() => setMenuOpen(false)} />}
  </div>
}

/** The anchor holds both buttons, so pressing the arrow again closes rather than reopens. */
function PaletteMenu({ anchor, palette, onChoose, onClose }: { anchor: RefObject<HTMLDivElement | null>; palette: SurfacePalette; onChoose: (palette: SurfacePalette) => void; onClose: () => void }) {
  const tr = useI18n()
  useOverlayLayer(anchor, onClose, true)
  return <div className="topbar-theme-menu" role="menu" aria-label={tr('Surface palette')}>
    {([['cool', tr('Cool neutral')], ['warm', tr('Warm')]] as const).map(([value, label]) =>
      <button key={value} type="button" role="menuitemradio" aria-checked={palette === value} onClick={() => onChoose(value)}>
        <ToolbarIcon name="check" size={14} />{label}
      </button>)}
  </div>
}
