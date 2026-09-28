import { useIsMobile } from '../../components/layout/useIsMobile'
import { ModeTabs } from './ModeTabs'

/** The compact and narrow layouts keep Chat and Practice in a tab bar at the
 * bottom of the window, in both places; the coach opens from the chat itself. */
export function MobileNav() {
  const isMobile = useIsMobile()
  return isMobile ? <ModeTabs placement="bottom" /> : null
}
