import type { ToolbarIconName } from '../controls/ToolbarIcon'
import type { EffortDimension, EffortProgress } from '../../generated/contracts'
export type EffortField = keyof Pick<EffortProgress, 'partnerUnderstood' | 'revisionsSent' | 'practiceAttempts' | 'explorations' | 'bot'>
/** Conversation-scoped units: practice happens in Practice, never in a chat. */
export const conversationUnits: readonly EffortField[] = ['partnerUnderstood', 'revisionsSent', 'explorations', 'bot']
/** The action kinds, each with what earns one (native: learning/effort). One
 * source earns at most one of each kind; deleting the source keeps the count. */
export const effortDimensions: { field: EffortField; dimension: EffortDimension; icon: ToolbarIconName; label: string; description: string }[] = [
  { field: 'partnerUnderstood', dimension: 'partner_understood', icon: 'smile', label: 'Understood',
    description: 'A message you sent that your conversation partner understood, according to the partner understanding check.' },
  { field: 'revisionsSent', dimension: 'revisions_sent', icon: 'fixes', label: 'Fixes',
    description: 'A message you edited and sent again with different wording.' },
  { field: 'practiceAttempts', dimension: 'practice_attempts', icon: 'practice', label: 'Practice',
    description: 'A Practice recording that matched at least about a third of the phrase. Silent recordings do not count.' },
  { field: 'bot', dimension: 'bot', icon: 'bot', label: 'Bot',
    description: 'Shaping or inspecting the AI: creating a conversation partner, choosing a topic or editing the prompt for a conversation, or opening the details of an AI request.' },
  { field: 'explorations', dimension: 'explorations', icon: 'telescope', label: 'Explore',
    description: 'Asking for something new: a translation, word meanings or grammar of a message, reply help or explanations, a coach reply, feedback with your own context, or new practice cards.' },
]
