import { createContext } from 'react'
import type { MessageEvidence } from '../../lib/message-evidence'
export const RewardInspectionContext = createContext<{
  presenting: boolean
  open: (evidence: MessageEvidence[], messageId: number, source: string) => void
} | null>(null)
