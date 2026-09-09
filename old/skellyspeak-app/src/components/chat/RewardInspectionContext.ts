import { createContext } from 'react'
import type { MessageEvidence } from '../../lib/message-evidence'
export const RewardInspectionContext = createContext<{
  arrive: (evidence: MessageEvidence[], messageId: number, source: string) => void
  open: (evidence: MessageEvidence[], messageId: number, source: string) => void
} | null>(null)
