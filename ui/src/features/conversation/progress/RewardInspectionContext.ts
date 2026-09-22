import { createContext } from 'react'
import type { MessageEvidence } from '../../../domain/learning/evidence/message-evidence'
export const RewardInspectionContext = createContext<{
  enabled?: boolean
  presenting?: boolean
  beginClaim?: () => () => void
  arrive: (evidence: MessageEvidence[], messageId: number, source: string) => void
  open: (evidence: MessageEvidence[], messageId: number, source: string) => void
} | null>(null)
