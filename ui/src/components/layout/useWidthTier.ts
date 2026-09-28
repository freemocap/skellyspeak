import { useEffect, useState } from 'react'

/// The three layouts, chosen by the width the app has rather than the device, so
/// a desktop window dragged narrow behaves like a phone:
///
///   full     wider than 860px: monitors and laptops. Tabs at the top; side
///            panels open beside the work.
///   compact  401–860px: large phones, tablets, narrow windows. Tabs at the
///            bottom; side panels open as drawers from their edge.
///   narrow   400px and below: standard phones. Tabs at the bottom; side panels
///            open as sheets from the bottom.
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
