import type { AudioInspection, SpeechAudioState } from '../../generated/contracts'
import { inspectionResource, peekInspection } from '../audio/inspection-resource'
import { invoke } from './native'

export function readMessageAudio(sessionId: string, operationId: string, cursor?: { sampleOffset: number; executionId: string }): Promise<SpeechAudioState> {
  return invoke('read_speech_audio', { sessionId, operationId, ...cursor })
}

type ReadySpeech = Extract<SpeechAudioState, { status: 'ready' }>
const key = (sessionId: string, audio: ReadySpeech) => JSON.stringify(['message', sessionId, audio])
export function peekMessageInspection(sessionId: string, audio: ReadySpeech) { return peekInspection(key(sessionId, audio)) }
export function inspectMessageSpeech(sessionId: string, audio: ReadySpeech): Promise<AudioInspection> {
  const { operationId, attemptId, audioBase64, alignment: speechAlignment } = audio
  return inspectionResource(key(sessionId, audio), () => invoke('inspect_message_speech', { sessionId, operationId, attemptId, audioBase64, speechAlignment }))
}
