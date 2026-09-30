import type { ToolbarIconName } from '../controls/ToolbarIcon'
import type { EffortDimension, EffortProgress } from '../../generated/contracts'
export type EffortField = keyof Pick<EffortProgress, 'partnerUnderstood' | 'revisionsSent' | 'practiceAttempts' | 'noIssuesFlagged'>
/** Conversation-scoped units: practice happens in Practice, never in a chat. */
export const conversationUnits: readonly EffortField[] = ['partnerUnderstood', 'noIssuesFlagged', 'revisionsSent']
export const effortDimensions: { field: EffortField; dimension: EffortDimension; icon: ToolbarIconName; label: string }[] = [
  { field: 'partnerUnderstood', dimension: 'partner_understood', icon: 'smile', label: 'Understood' },
  { field: 'noIssuesFlagged', dimension: 'no_issues_flagged', icon: 'clean', label: 'Clean' },
  { field: 'revisionsSent', dimension: 'revisions_sent', icon: 'fixes', label: 'Fixes' },
  { field: 'practiceAttempts', dimension: 'practice_attempts', icon: 'practice', label: 'Practice' },
]
