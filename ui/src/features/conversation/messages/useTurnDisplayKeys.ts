import { useRef } from 'react'

/** Revisions replace native records but keep their mounted presentation slot.
 * Retain only identities in this mounted conversation; no product data is cached. */
export function useTurnDisplayKeys(chatId: string | null, turns: readonly { turnId?: string; replacesTurnId?: string | null }[]) {
  const state = useRef({ chatId, keys: new Map<string, string>() })
  if (state.current.chatId !== chatId) state.current = { chatId, keys: new Map() }
  const { keys } = state.current
  const parents = new Map(turns.filter(turn => turn.turnId).map(turn => [turn.turnId!, turn.replacesTurnId]))
  for (const turn of turns) {
    if (!turn.turnId || keys.has(turn.turnId)) continue
    const chain: string[] = []
    let id = turn.turnId
    while (!keys.has(id) && !chain.includes(id)) {
      chain.push(id)
      const parent = parents.get(id)
      if (!parent) break
      id = parent
    }
    const key = keys.get(id) ?? id
    for (const member of chain) keys.set(member, key)
  }
  return keys
}
