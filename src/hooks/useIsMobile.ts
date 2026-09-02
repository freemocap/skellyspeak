import { useEffect, useState } from 'react'

/// The one definition of "mobile mode". Below this width the app switches to
/// single-surface layouts: tabbed Chat/Coach/Analysis in GuidedPage, and a
/// single stacked scroll in Settings.
export const MOBILE_BREAKPOINT_PX = 860

const QUERY = `(max-width: ${MOBILE_BREAKPOINT_PX}px)`

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches
  )
  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    setIsMobile(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return isMobile
}
