/** DOM predicates shared by the device runner and its jsdom regression checks.
 * Keep these functions self-contained: CDP serializes them into the app page.
 */
export function completedExchange(root: Document, learnerCount: number): boolean {
  const learners = Array.from(root.querySelectorAll('.stream .msg.me[data-reward-message]'))
  if (learners.length !== learnerCount) return false
  const turn = learners.at(-1)?.closest('.turn-stack')
  return !!turn?.querySelector('.msg.bot:not(.pending)')
    && turn.querySelector('.feedback-badge')?.getAttribute('data-feedback-state') === 'complete'
}

export interface Disclosure {
  message: string
  start: string
  word: string
  expanded: string | null
  meaningVisible: boolean
}

export function readDisclosure(root: Document, message: string, start: string): Disclosure | null {
  const bubble = Array.from(root.querySelectorAll('.stream .msg.me[data-reward-message]'))
    .find(node => node.getAttribute('data-reward-message') === message)
  const saved = Array.from(bubble?.querySelectorAll('.saved-word') ?? [])
    .find(node => node.getAttribute('data-source-start') === start)
  const word = saved?.querySelector('[role="button"][aria-expanded]')
  if (!word) return null
  return {
    message, start, word: word.textContent ?? '', expanded: word.getAttribute('aria-expanded'),
    meaningVisible: Array.from(saved!.querySelectorAll<HTMLElement>('.wg'))
      .some(node => !!node.textContent?.trim() && node.getClientRects().length > 0),
  }
}

export function disclosureOpened(before: Disclosure, after: Disclosure | null): boolean {
  return before.expanded === 'false' && !before.meaningVisible
    && after?.message === before.message && after.start === before.start && after.word === before.word
    && after.expanded === 'true' && after.meaningVisible
}
