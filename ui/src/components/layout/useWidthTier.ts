import { useEffect, useState } from 'react'

/// The three layouts, chosen by the width the app has rather than the device, so
/// a desktop window dragged narrow behaves like a phone:
///
///   full     wider than 860px: monitors and laptops. Side panels open beside
///            the work and fold to edge tabs.
///   compact  401–860px: large phones, tablets, narrow windows. Side panels are
///            edge tabs on the work's edges and open as drawers from there.
///   narrow   400px and below: standard phones. Side panels open from buttons
///            as sheets from the bottom.
///
/// The Chat and Practice tabs lead the top bar in all three.
///
/// Stylesheets use the same widths: `(max-width: 860px)` and `(max-width: 400px)`.
export type WidthTier = 'full' | 'compact' | 'narrow'

const COMPACT_QUERY = '(max-width: 860px)'
const NARROW_QUERY = '(max-width: 400px)'

function currentTier(): WidthTier {
  if (typeof window === 'undefined') return 'full'
  if (window.matchMedia(NARROW_QUERY).matches) return 'narrow'
  return window.matchMedia(COMPACT_QUERY).matches ? 'compact' : 'full'
}

export function useWidthTier(): WidthTier {
  const [tier, setTier] = useState(currentTier)
  useEffect(() => {
    const queries = [window.matchMedia(COMPACT_QUERY), window.matchMedia(NARROW_QUERY)]
    const update = () => setTier(currentTier())
    update()
    queries.forEach(query => query.addEventListener?.('change', update))
    return () => queries.forEach(query => query.removeEventListener?.('change', update))
  }, [])
  return tier
}
