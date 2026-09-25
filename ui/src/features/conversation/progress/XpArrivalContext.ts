import { createContext } from 'react'

/** One point in a message-local payout; saved totals remain authoritative. */
export type XpArrival = { key: number; messageId: number; source: string; paid: boolean }
export const XpArrivalContext = createContext<{ arrivals: XpArrival[] } | null>(null)
