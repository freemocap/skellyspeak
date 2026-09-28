import { useWidthTier } from './useWidthTier'

/// The one definition of "mobile mode": the compact and narrow tiers, where the
/// app shows one workspace surface at a time, the Chat and Practice tabs sit at
/// the bottom, and Settings is a single stacked scroll. See useWidthTier.
export function useIsMobile(): boolean {
  return useWidthTier() !== 'full'
}
