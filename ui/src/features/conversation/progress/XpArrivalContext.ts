import { createContext } from 'react'
import type { MessageEvidence } from '../../../domain/learning/evidence/message-evidence'

/** One saved award waiting to be shown; `xp` is the gain, not the skill total. */
export type XpArrival = { key: number; evidence: MessageEvidence[]; messageId: number; source: string; xp: number; milestone?: number }

export const XpArrivalContext = createContext<{
  arrivals: XpArrival[]
  fastMode: boolean
  dismiss: (key: number) => void
} | null>(null)
