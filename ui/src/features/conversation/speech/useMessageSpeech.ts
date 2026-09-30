import { errorDetails, errorMessage } from '../../../platform/diagnostics/error-details'
import { useCallback, useEffect, useRef, useState } from 'react'
import { readMessageAudio } from '../../../platform/ipc/message-speech'
import type { ConversationSnapshot, SpeechAudioState } from '../../../generated/contracts'
import { executeAction } from '../../../platform/ipc/workspace'
import { reportFault } from '../../../platform/diagnostics/faults'
import { interruptSpeech, speechPlaybackPermit } from '../../../platform/audio/speech'
import { playSpeechAudio, type PlaybackHandle } from '../../../platform/audio/speech-player'

export interface MessageAudio {
  sessionId: string
  audio: Extract<SpeechAudioState, { status: 'ready' }>
}

/** Snapshot observation reads audio only; generation is exclusive to explicit replay. */
export function useMessageSpeech(snapshot: ConversationSnapshot | null, conversationId: string | null, enabled: boolean, active: boolean, rate = 1, volume = 1) {
  const playback = useRef({ rate, volume }); playback.current = { rate, volume }
  const latest = useRef(snapshot); latest.current = snapshot
  const generation = useRef(0)
  const current = useRef<{ messageId: string; operationId: string | null; sessionId: string; stop?: () => void } | null>(null)
  const [messageId, setMessageId] = useState<string | null>(null)
  const [phase, setPhase] = useState<'idle' | 'preparing' | 'playing'>('idle')
  const [retained, setRetained] = useState<MessageAudio | null>(null)
  const [time, setTime] = useState(0)
  const playerRef = useRef<PlaybackHandle | null>(null)
  const duration = useRef(0)
  const [failure, setFailure] = useState<{ messageId: string; text: string; details: unknown } | null>(null)
  const baseline = useRef<{ conversation: string; messages: Set<string>; eligible: Set<string>; operations: Set<string> } | null>(null)

  const cancelOperation = useCallback((sessionId: string, operationId: string) => {
    void executeAction({ sessionId }, { kind: 'cancelMessageSpeech', operationId })
      .catch(error => reportFault('Stopping speech', error))
  }, [])
  const stop = useCallback(() => {
    generation.current++
    const previous = current.current
    current.current = null
    previous?.stop?.()
    playerRef.current = null
    if (previous?.operationId && !previous.stop) cancelOperation(previous.sessionId, previous.operationId)
    baseline.current?.eligible.clear()
    setMessageId(null)
    setPhase('idle')
  }, [cancelOperation])

  useEffect(() => {
    baseline.current = null
    setFailure(null)
    setRetained(null); setTime(0)
    return stop
  }, [conversationId, active, stop])

  useEffect(() => { if (!enabled) stop() }, [enabled, stop])
  useEffect(() => { playerRef.current?.setRate(rate) }, [rate])
  useEffect(() => { playerRef.current?.setVolume(volume) }, [volume])

  const consume = useCallback(async (scope: number, permit: object, sessionId: string, operationId: string, sourceId: string, startSeconds = 0) => {
    while (scope === generation.current) {
      const audio = await readMessageAudio(sessionId, operationId)
      if (scope !== generation.current) return
      if (speechPlaybackPermit() !== permit) { stop(); return }
      if (audio.operationId !== operationId || audio.messageId !== sourceId) throw new Error('Speech does not belong to this reply.')
      if (audio.status === 'pending') { await new Promise(resolve => setTimeout(resolve, 400)); continue }
      if (audio.status === 'unavailable') throw { message: audio.message, code: audio.reason, diagnostics: { ...audio.diagnostics as object, operationId, attemptId: audio.attemptId } }
      setRetained({ sessionId, audio }); setTime(startSeconds)
      const finish = () => { if (scope === generation.current) { current.current = null; playerRef.current = null; setMessageId(null); setPhase('idle') } }
      const player = playSpeechAudio(audio, finish, error => {
        if (scope === generation.current) { setFailure({ messageId: sourceId, text: errorMessage(error), details: errorDetails(error) }); reportFault('Speech playback', error); finish() }
      }, playback.current.rate, playback.current.volume, {
        sourceText: latest.current?.messages.find(message => message.id === sourceId)?.text,
        startSeconds,
        onReady: handle => { if (scope === generation.current) playerRef.current = handle },
        onPlaying: playing => { if (scope === generation.current && current.current?.messageId === sourceId) setPhase(playing ? 'playing' : 'preparing') },
        onTime: (seconds, total) => { if (scope === generation.current) { duration.current = total; setTime(seconds) } },
      })
      current.current = { messageId: sourceId, operationId, sessionId, stop: player.stop }
      try { await player.play() } catch (error) { player.stop(); throw error }
      return
    }
  }, [stop])

  const start = useCallback(async (sourceId: string, operationId?: string, startSeconds = 0) => {
    const state = latest.current
    const permit = interruptSpeech()
    if (!permit || !state || state.conversationId !== conversationId || !active) return
    stop()
    const scope = generation.current
    current.current = { messageId: sourceId, operationId: operationId ?? null, sessionId: state.sessionId }
    setMessageId(sourceId); setPhase('preparing'); setFailure(null)
    try {
      if (!operationId) {
        const receipt = await executeAction(state, { kind: 'requestMessageSpeech', messageId: sourceId })
        if (!receipt.entityId) throw new Error('Speech operation was not returned.')
        operationId = receipt.entityId
        if (scope !== generation.current) { cancelOperation(state.sessionId, operationId); return }
        current.current = { messageId: sourceId, operationId, sessionId: state.sessionId }
      }
      if (speechPlaybackPermit() !== permit) { stop(); return }
      await consume(scope, permit, state.sessionId, operationId, sourceId, startSeconds)
    } catch (error) {
      if (scope === generation.current) { current.current = null; playerRef.current = null; setMessageId(null); setPhase('idle'); setFailure({ messageId: sourceId, text: errorMessage(error), details: errorDetails(error) }); reportFault('Speech', error) }
    }
  }, [active, conversationId, stop, consume, cancelOperation])

  useEffect(() => {
    if (!snapshot || snapshot.conversationId !== conversationId) return
    const messages = snapshot.messages.filter(item => item.role === 'assistant' && !item.replacedBy)
    if (current.current && snapshot.messages.some(item => item.id === current.current?.messageId && item.replacedBy)) stop()
    const operations = snapshot.turns.filter(turn => !turn.replacedBy).flatMap(turn => turn.operations).filter(item => item.kind === 'persona_speech')
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
  }, [snapshot, conversationId, enabled, active, start, stop])

  const toggle = useCallback((sourceId: string) => {
    if (current.current?.messageId === sourceId) stop()
    else void start(sourceId)
  }, [start, stop])
  const seek = (sourceId: string, seconds: number) => {
    if (retained?.audio.messageId !== sourceId || !Number.isFinite(seconds)) return
    setTime(seconds)
    if (current.current?.messageId === sourceId) playerRef.current?.seek(seconds)
  }
  const resume = (sourceId: string) => {
    if (current.current?.messageId === sourceId) stop()
    else if (retained?.audio.messageId === sourceId) void start(sourceId, retained.audio.operationId, time < duration.current ? time : 0)
    else void start(sourceId)
  }
  return { messageId, phase, failure, stop, toggle, retained, time, seek, resume }
}
