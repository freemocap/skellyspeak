import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '../../lib/native'
import type { ConversationSnapshot, SpeechAudioState } from '../../contracts'
import { executeAction, nativeError } from '../../lib/workspace'
import { reportFault } from '../../lib/faults'
import { playSpeechAudio } from './speech-player'

/** Snapshot observation reads audio only; generation is exclusive to explicit replay. */
export function useMessageSpeech(snapshot: ConversationSnapshot | null, conversationId: string | null, enabled: boolean, active: boolean, rate = 1, volume = 1) {
  const playback = useRef({ rate, volume }); playback.current = { rate, volume }
  const latest = useRef(snapshot); latest.current = snapshot
  const generation = useRef(0)
  const current = useRef<{ messageId: string; operationId: string | null; sessionId: string; stop?: () => void } | null>(null)
  const [messageId, setMessageId] = useState<string | null>(null)
  const [failure, setFailure] = useState<{ messageId: string; text: string } | null>(null)
  const baseline = useRef<{ conversation: string; messages: Set<string>; eligible: Set<string>; operations: Set<string> } | null>(null)

  const cancelOperation = useCallback((sessionId: string, operationId: string) => {
    void executeAction({ sessionId }, { kind: 'cancelMessageSpeech', operationId })
      .catch(error => reportFault('Stopping speech', nativeError(error)))
  }, [])
  const stop = useCallback(() => {
    generation.current++
    const previous = current.current
    current.current = null
    previous?.stop?.()
    if (previous?.operationId && !previous.stop) cancelOperation(previous.sessionId, previous.operationId)
    baseline.current?.eligible.clear()
    setMessageId(null)
  }, [cancelOperation])

  useEffect(() => {
    baseline.current = null
    setFailure(null)
    return stop
  }, [conversationId, active, stop])

  useEffect(() => { if (!enabled) stop() }, [enabled, stop])

  const consume = useCallback(async (scope: number, sessionId: string, operationId: string, sourceId: string) => {
    while (scope === generation.current) {
      const audio = await invoke<SpeechAudioState>('read_speech_audio', { sessionId, operationId })
      if (scope !== generation.current) return
      if (audio.operationId !== operationId || audio.messageId !== sourceId) throw new Error('Speech does not belong to this reply.')
      if (audio.status === 'pending') { await new Promise(resolve => setTimeout(resolve, 400)); continue }
      if (audio.status === 'unavailable') throw new Error(`Speech unavailable: ${audio.reason}`)
      const finish = () => { if (scope === generation.current) { current.current = null; setMessageId(null) } }
      const player = playSpeechAudio(audio, finish, () => {
        if (scope === generation.current) { setFailure({ messageId: sourceId, text: 'Audio playback failed.' }); finish() }
      }, playback.current.rate, playback.current.volume)
      current.current = { messageId: sourceId, operationId, sessionId, stop: player.stop }
      try { await player.play() } catch (error) { player.stop(); throw error }
      return
    }
  }, [])

  const start = useCallback(async (sourceId: string, operationId?: string) => {
    const state = latest.current
    if (!state || state.conversationId !== conversationId || !active) return
    stop()
    const scope = generation.current
    current.current = { messageId: sourceId, operationId: operationId ?? null, sessionId: state.sessionId }
    setMessageId(sourceId); setFailure(null)
    try {
      if (!operationId) {
        const receipt = await executeAction(state, { kind: 'requestMessageSpeech', messageId: sourceId })
        if (!receipt.entityId) throw new Error('Speech operation was not returned.')
        operationId = receipt.entityId
        if (scope !== generation.current) { cancelOperation(state.sessionId, operationId); return }
        current.current = { messageId: sourceId, operationId, sessionId: state.sessionId }
      }
      await consume(scope, state.sessionId, operationId, sourceId)
    } catch (error) {
      if (scope === generation.current) { current.current = null; setMessageId(null); setFailure({ messageId: sourceId, text: nativeError(error) }) }
    }
  }, [active, conversationId, stop, consume, cancelOperation])

  useEffect(() => {
    if (!snapshot || snapshot.conversationId !== conversationId) return
    const messages = snapshot.messages.filter(item => item.role === 'assistant')
    const operations = snapshot.turns.flatMap(turn => turn.operations).filter(item => item.kind === 'partner_speech')
    if (!baseline.current || baseline.current.conversation !== conversationId) {
      baseline.current = { conversation: conversationId, messages: new Set(messages.map(item => item.id)), eligible: new Set(), operations: new Set(operations.filter(item => item.sourceMessageId).map(item => item.id)) }
      return
    }
    const seen = baseline.current
    for (const item of messages) {
      if (!seen.messages.has(item.id) && enabled && active) seen.eligible.add(item.id)
      seen.messages.add(item.id)
    }
    if (!enabled || !active) seen.eligible.clear()
    for (const operation of operations) {
      if (seen.operations.has(operation.id) || !operation.sourceMessageId) continue
      seen.operations.add(operation.id)
      if (!seen.eligible.delete(operation.sourceMessageId) || current.current?.messageId === operation.sourceMessageId) continue
      void start(operation.sourceMessageId, operation.id)
    }
  }, [snapshot, conversationId, enabled, active, start])

  const toggle = useCallback((sourceId: string) => {
    if (current.current?.messageId === sourceId) stop()
    else void start(sourceId)
  }, [start, stop])
  return { messageId, failure, stop, toggle }
}
