import type { StoredTurn } from '../types'

/// How long a title can get before it stops helping you pick a conversation
/// out of a list.
const TITLE_MAX = 52

/// A name for a conversation, taken from the first thing said in it.
///
/// The learner's own first message is preferred over the tutor's greeting:
/// greetings are near-identical across conversations ("¡Hola! ¿Cómo estás?"),
/// so a list titled by them is a list of indistinguishable rows. What you
/// actually remember about a conversation is what *you* brought to it.
///
/// This lives on the webview side because it is the side that knows what a
/// turn looks like; Rust stores the resulting string without interpreting it.
export function conversationTitle(turns: StoredTurn[]): string {
  const firstUser = turns.find((t) => t.user && t.user.trim())?.user
  const firstReply = turns.find((t) => t.assistant?.reply?.trim())?.assistant?.reply
  return trim(firstUser ?? firstReply ?? '')
}

function trim(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= TITLE_MAX) return clean
  // Break on a word boundary when there is a reasonable one, so the title does
  // not end mid-word.
  const cut = clean.slice(0, TITLE_MAX)
  const space = cut.lastIndexOf(' ')
  return `${(space > TITLE_MAX * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}
