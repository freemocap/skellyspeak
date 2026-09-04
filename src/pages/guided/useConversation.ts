import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatSummary, Settings, StoredTurn } from '../../types'
import {
  deleteConversation,
  isTauri,
  listConversations,
  loadConversation,
  newConversation,
  openConversation,
  saveConversation,
} from '../../lib/tauri'
import { conversationTitle } from '../../lib/conversation'
import { reportFault } from '../../lib/faults'
import { logInfo } from '../../lib/log'
import { armGreeting, disarmGreeting } from '../../hooks/useSteering'

/// A turn on screen: everything that gets stored, plus the streaming buffer
/// for the reply still arriving. `StoredTurn` is the shape on disk.
export type Turn = StoredTurn & { pendingText: string }

/// How long the conversation rests before it is written. Long enough that a
/// streamed reply is one write rather than one per token, short enough that
/// closing the app straight after a turn still catches it.
const SAVE_DEBOUNCE_MS = 800

interface Options {
  /// Null until settings have loaded. The pairing comes from here.
  settings: Settings | null
  /// A turn in flight; saving waits for it to settle.
  sending: boolean
  setHistoryOpen: (open: boolean) => void
  /// Open an empty conversation with a greeting.
  greet: () => void
  /// Clear everything tied to the conversation leaving the screen — pinned
  /// turn, reveals, chips, popups. Owned by the page, because it is page state.
  resetView: () => void
}

/// Which conversation is on screen, and everything that changes it.
///
/// The turns themselves live here because every operation — restoring,
/// switching chats, starting a new one, saving — is about them, and splitting
/// the state from the operations is what let saves race switches before.
export function useConversation({
  settings,
  sending,
  setHistoryOpen,
  greet,
  resetView,
}: Options) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [chats, setChats] = useState<ChatSummary[]>([])

  const turnsRef = useRef<Turn[]>([])
  turnsRef.current = turns
  const nextIdRef = useRef(1)

  // Which chat the turns on screen belong to. Saves are addressed to THIS
  // chat, not to whatever settings say right now, so a save landing after a
  // language switch or a chat change still files the turns under the
  // conversation they came from.
  const openKey = useRef<{ target: string; native: string; id: string } | null>(null)

  // Callbacks from the page, read through refs so an unstable one from the
  // caller cannot churn this hook's effects. Identity churn here is what once
  // fired a second greeting on top of the first.
  const greetRef = useRef(greet)
  greetRef.current = greet
  const resetViewRef = useRef(resetView)
  resetViewRef.current = resetView
  const settingsRef = useRef<Settings | null>(settings)
  settingsRef.current = settings

  const refreshChats = useCallback(async (target: string, native: string) => {
    try {
      setChats(await listConversations(target, native))
    } catch (e) {
      reportFault('Loading your chat history', e)
    }
  }, [])

  /// Put a conversation's turns on screen and mark it as the one saves belong
  /// to. `load` decides which conversation — the open one, or a named one.
  const show = useCallback(
    async (
      target: string,
      native: string,
      load: () => Promise<{ id: string; turns: StoredTurn[] }>
    ) => {
      try {
        const opened = await load()
        openKey.current = { target, native, id: opened.id }
        setTurns(opened.turns.map((t) => ({ ...t, pendingText: '' })))
        // Ids must continue past what was restored or a new turn would collide
        // with an old one and React would reconcile the wrong bubble.
        nextIdRef.current = opened.turns.reduce((max, t) => Math.max(max, t.id), 0) + 1
        void refreshChats(target, native)
        return opened.turns.length
      } catch (e) {
        reportFault('Opening that conversation', e)
        setTurns([])
        return 0
      }
    },
    [refreshChats]
  )

  // Written after a pause rather than on every keystroke of the stream, and
  // never before a restore has run — saving an empty list first would erase
  // the conversation we are about to load. Only settled turns are stored: one
  // still streaming has no reply to keep.
  useEffect(() => {
    if (!isTauri) return
    const key = openKey.current
    if (!key || sending) return
    const timer = setTimeout(() => {
      const stored = turns
        .filter((t) => t.assistant !== null)
        .map(({ pendingText: _pendingText, ...rest }) => rest)
      void saveConversation(
        key.target,
        key.native,
        key.id,
        stored,
        // The title comes from here because this is the side that knows what a
        // turn looks like; Rust only stores the string.
        conversationTitle(stored)
      )
        .then(() => refreshChats(key.target, key.native))
        .catch((e: unknown) => reportFault('Saving your conversation', e))
    }, SAVE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [turns, sending, refreshChats])

  /// Open a clean conversation. The previous one stays in the list, and what
  /// the tutor has learned about the learner is untouched — that continuity is
  /// the whole reason the observer exists.
  const startNew = useCallback(async () => {
    const s = settingsRef.current
    if (!s) return
    setHistoryOpen(false)
    let id: string
    try {
      id = await newConversation(s.target_language, s.native_language)
    } catch (e) {
      reportFault('Starting a new conversation', e)
      return
    }
    openKey.current = { target: s.target_language, native: s.native_language, id }
    setTurns([])
    nextIdRef.current = 1
    resetViewRef.current()
    void refreshChats(s.target_language, s.native_language)
    disarmGreeting()
    armGreeting()
    greetRef.current()
  }, [refreshChats, setHistoryOpen])

  const openChat = useCallback(
    async (id: string) => {
      const s = settingsRef.current
      if (!s || id === openKey.current?.id) {
        setHistoryOpen(false)
        return
      }
      setHistoryOpen(false)
      resetViewRef.current()
      const restored = await show(s.target_language, s.native_language, () =>
        openConversation(s.target_language, s.native_language, id)
      )
      // An empty chat reopened is still an empty chat: greet it so there is
      // something to reply to, exactly as a new one would be.
      if (restored === 0) {
        disarmGreeting()
        armGreeting()
        greetRef.current()
      }
    },
    [show, setHistoryOpen]
  )

  const removeChat = useCallback(
    async (id: string) => {
      const s = settingsRef.current
      if (!s) return
      try {
        await deleteConversation(s.target_language, s.native_language, id)
      } catch (e) {
        reportFault('Deleting that conversation', e)
        return
      }
      // Deleting the conversation you are looking at leaves nothing on screen,
      // so open the newest of what is left, or start fresh if none remain.
      if (id === openKey.current?.id) {
        const left = await listConversations(s.target_language, s.native_language)
        setChats(left)
        if (left.length > 0) {
          await openChat(left[0].id)
        } else {
          await startNew()
        }
        return
      }
      void refreshChats(s.target_language, s.native_language)
    },
    [openChat, refreshChats, startNew]
  )

  // The conversation on screen follows the pairing — on first load and on
  // every switch. Each pairing keeps its turns, coach thread and tutor memory
  // separately, so going to Arabic and back to Spanish returns to the Spanish
  // conversation rather than starting over. The dialect is NOT part of a
  // pairing: changing it is a setting applied to the conversation you are in.
  //
  // This is the only place that decides between restoring and greeting, and it
  // runs only when the pairing actually changes — never on a settings autosave,
  // which bumps on every keystroke in the Settings modal and would otherwise
  // reload over turns that had not been written yet.
  const pairing = settings ? `${settings.target_language}|${settings.native_language}` : null
  const previousPairing = useRef<string | null>(null)
  useEffect(() => {
    if (!pairing || !settings || !isTauri) return
    const previous = previousPairing.current
    previousPairing.current = pairing
    if (previous === pairing) return
    const switched = previous !== null
    if (switched) {
      logInfo('[guided] language pair changed:', previous, '->', pairing)
      resetViewRef.current()
    }
    const { target_language: target, native_language: native } = settings
    void (async () => {
      const restored = await show(target, native, () => loadConversation(target, native))
      if (restored > 0) {
        logInfo(`[guided] restored ${restored} turns — no greeting`)
        // Consume the once-per-session greeting: a restored conversation is
        // already open, and greeting over it would both duplicate the opening
        // and make it look like nothing had been kept.
        armGreeting()
        return
      }
      // Empty conversation — open it properly. On a switch the greeting has
      // usually already been spent on the previous pairing.
      if (switched) disarmGreeting()
      if (armGreeting()) {
        logInfo('[guided] firing greeting turn')
        greetRef.current()
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairing])

  return {
    turns,
    setTurns,
    turnsRef,
    nextIdRef,
    chats,
    currentChatId: openKey.current?.id ?? null,
    // The same value, read at call time rather than at render time. The
    // greeting turn is fired from inside the effect that opens the chat, so a
    // callback that closed over `currentChatId` would still be holding the
    // null from the render before the chat existed — and the partner picked
    // for a whole conversation is seeded from this id.
    chatIdRef: openKey,
    openChat,
    startNew,
    removeChat,
  }
}
