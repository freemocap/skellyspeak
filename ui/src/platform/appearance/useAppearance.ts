import { useEffect } from 'react'
import { DEFAULT_APPEARANCE } from '../../generated/contracts'
import type { Settings } from '../../types'

/** Apply learner-owned appearance at the app boundary, including portaled overlays. */
export function useAppearance(settings: Settings | null) {
  const appearance = settings?.appearance ?? DEFAULT_APPEARANCE
  const theme = settings?.theme ?? 'light'
  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => { root.dataset.theme = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme }
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [theme])
  useEffect(() => {
    const root = document.documentElement
    root.dataset.palette = appearance.palette
    root.dataset.density = appearance.controlDensity
    root.dataset.spacing = appearance.layoutSpacing
    root.dataset.depth = appearance.depth
    const amount = appearance.glowEnabled ? appearance.glowStrength : 0
    const color = `color-mix(in srgb, ${appearance.glowColor} ${amount}%, transparent)`
    root.style.setProperty('--appearance-glow', `0 0 18px 3px ${color}`)
    root.style.setProperty('--appearance-glow-inset', `inset 0 0 18px 3px ${color}`)
  }, [appearance])
}
