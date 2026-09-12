// Playback through the selected cloud or OS engine, with one active utterance.
import { invoke, type ConversationPartner } from '../ipc/tauri'

export interface SpeechProgress {
  utteranceId: string
}

let cachedVoices: SpeechSynthesisVoice[] = []
let speakToken = 0
let currentAudio: HTMLAudioElement | null = null
let currentUtterance: SpeechSynthesisUtterance | null = null
let voiceVolume = 1
let finishPlayback: (() => void) | null = null
let speakingState = false
let progress: SpeechProgress | null = null
let playbackAllowed = true
const speakingListeners = new Set<(value: boolean) => void>()
const progressListeners = new Set<(value: SpeechProgress | null) => void>()

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function ttsAvailable(engine: string, osVoiceReady: boolean): boolean {
  return engine === 'cloud' || (engine === 'os' && osVoiceReady)
}

export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!speechSupported()) return Promise.resolve([])
  const existing = window.speechSynthesis.getVoices()
  if (existing.length) { cachedVoices = existing; return Promise.resolve(existing) }
  return new Promise((resolve) => {
    const collect = () => {
      clearTimeout(timer)
      window.speechSynthesis.removeEventListener('voiceschanged', collect)
      cachedVoices = window.speechSynthesis.getVoices()
      resolve(cachedVoices)
    }
    const timer = setTimeout(collect, 1500)
    window.speechSynthesis.addEventListener('voiceschanged', collect)
  })
}

function setSpeaking(value: boolean): void {
  if (speakingState === value) return
  speakingState = value
  speakingListeners.forEach((listener) => listener(value))
}

function setProgress(value: SpeechProgress | null): void {
  if (progress?.utteranceId === value?.utteranceId) return
  progress = value
  progressListeners.forEach((listener) => listener(value))
}

export function subscribeSpeaking(listener: (value: boolean) => void): () => void {
  speakingListeners.add(listener)
  return () => { speakingListeners.delete(listener) }
}

export function subscribeSpeechProgress(listener: (value: SpeechProgress | null) => void): () => void {
  progressListeners.add(listener)
  return () => { progressListeners.delete(listener) }
}

export function isSpeaking(): boolean { return speakingState }

/** Lifecycle suspension cancels playback; returning never resumes an utterance. */
export function setPlaybackAllowed(allowed: boolean): void {
  playbackAllowed = allowed
  if (!allowed) stopSpeaking()
}

function playbackIsAllowed(): boolean {
  return playbackAllowed && document.visibilityState !== 'hidden'
}

function canContinue(token: number): boolean {
  if (token !== speakToken) return false
  if (playbackIsAllowed()) return true
  stopSpeaking()
  return false
}

export function setPlaybackRate(rate: number): void {
  if (!Number.isFinite(rate) || rate < 0.5 || rate > 1.5) throw new Error('Voice speed must be between 0.5× and 1.5×.')
  if (currentAudio) currentAudio.playbackRate = rate
}

export function setVoiceVolume(volume: number): void {
  if (!Number.isFinite(volume) || volume < 0 || volume > 1) throw new Error('Voice volume must be between 0 and 1.')
  voiceVolume = volume
  if (currentAudio) currentAudio.volume = volume
  if (currentUtterance) currentUtterance.volume = volume
  if (volume === 0) stopSpeaking()
}

export function stopSpeaking(): void {
  speakToken += 1
  finishPlayback?.()
  finishPlayback = null
  if (speechSupported()) window.speechSynthesis.cancel()
  if (currentAudio) { currentAudio.pause(); currentAudio = null }
  currentUtterance = null
  setSpeaking(false)
  setProgress(null)
}

interface TtsAudio { audio_base64: string; mime: string }
interface CachedAudio { url: string; bytes: number }
const audioCache = new Map<string, CachedAudio>()
const pendingAudio = new Map<string, Promise<string>>()
const MAX_CACHE_BYTES = 24 * 1024 * 1024
let cacheBytes = 0

async function cloudTts(text: string, voice: string, chatId: string | null, scope: string): Promise<string> {
  const key = JSON.stringify([scope, chatId, voice, text])
  const cached = audioCache.get(key)
  if (cached) {
    audioCache.delete(key)
    audioCache.set(key, cached)
    return cached.url
  }
  const pending = pendingAudio.get(key)
  if (pending) return pending
  const request = synthesize(text, voice, key, chatId)
  pendingAudio.set(key, request)
  try { return await request }
  finally { pendingAudio.delete(key) }
}

async function synthesize(text: string, voice: string, key: string, chatId: string | null): Promise<string> {
  const result = await invoke<TtsAudio>('speak_text', { text, voice, chatId })
  const bytes = Uint8Array.from(atob(result.audio_base64), (character) => character.charCodeAt(0))
  if (bytes.length > MAX_CACHE_BYTES) throw new Error('Synthesized speech exceeds the playback size limit.')
  while (cacheBytes + bytes.length > MAX_CACHE_BYTES && audioCache.size) {
    const [oldKey, old] = audioCache.entries().next().value!
    audioCache.delete(oldKey)
    URL.revokeObjectURL(old.url)
    cacheBytes -= old.bytes
  }
  const url = URL.createObjectURL(new Blob([bytes], { type: result.mime }))
  audioCache.set(key, { url, bytes: bytes.length })
  cacheBytes += bytes.length
  return url
}

/** Resolves on completion or cancellation; synthesis and playback errors reject. */
export async function speakSmart(
  text: string, language: string, engine: string, voice: string, rate: number, utteranceId: string, chatId: string | null, scope: string
): Promise<boolean> {
  if (!text.trim()) throw new Error('Nothing to speak.')
  stopSpeaking()
  if (!playbackIsAllowed() || voiceVolume === 0) return false
  setPlaybackRate(rate)
  const token = speakToken
  setSpeaking(true)
  setProgress({ utteranceId })
  try {
    if (engine === 'cloud') {
      const url = await cloudTts(text, voice, chatId, JSON.stringify([language, scope]))
      if (!canContinue(token)) return false
      const audio = new Audio(url)
      audio.playbackRate = rate
      audio.volume = voiceVolume
      audio.preservesPitch = true
      currentAudio = audio
      return await new Promise<boolean>((resolve, reject) => {
        let finished = false
        const finish = (success: boolean, error: Error | null) => {
          if (finished) return
          finished = true
          audio.onended = audio.onerror = audio.onpause = null
          audio.pause()
          if (currentAudio === audio) currentAudio = null
          if (token === speakToken) { finishPlayback = null; setSpeaking(false); setProgress(null) }
          if (error) reject(error)
          else resolve(success)
        }
        finishPlayback = () => finish(false, null)
        audio.onended = () => finish(true, null)
        audio.onerror = () => finish(false, new Error('The synthesized audio could not be played.'))
        audio.onpause = () => finish(false, null)
        void audio.play()
          .catch((error: unknown) => finish(false, error instanceof Error ? error : new Error(String(error))))
      })
    }
    if (engine !== 'os') throw new Error('Unknown speech engine. Choose Cloud or OS voice in Settings.')
    if (!speechSupported()) throw new Error('OS speech is unavailable on this platform. Choose Cloud in Settings.')
    const voices = cachedVoices.length ? cachedVoices : window.speechSynthesis.getVoices()
    const partner = chatId ? await invoke<ConversationPartner>('get_conversation_partner', { chatId }) : null
    if (!canContinue(token)) return false
    const exact = voices.filter(candidate => candidate.lang.toLowerCase().replace('_', '-') === language.toLowerCase())
    const candidates = (exact.length ? exact : voices.filter(candidate => candidate.lang.toLowerCase().split(/[-_]/)[0] === language.toLowerCase().split('-')[0])).sort((a, b) => a.voiceURI.localeCompare(b.voiceURI))
    const identity = partner && partner.persona.id !== '__none__' ? partner.persona.id : ''
    const hash = Array.from(identity).reduce((value, character) => (value * 31 + character.codePointAt(0)!) >>> 0, 0)
    const selected = candidates[hash % candidates.length]
    if (!selected) throw new Error(`No installed OS voice can speak ${language}.`)
    return await new Promise<boolean>((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = language
      utterance.voice = selected
      utterance.rate = rate
      utterance.volume = voiceVolume
      currentUtterance = utterance
      let finished = false
      const finish = (success: boolean, error: Error | null) => {
        if (finished) return
        finished = true
        utterance.onend = utterance.onerror = null
        if (currentUtterance === utterance) currentUtterance = null
        if (token === speakToken) { finishPlayback = null; setSpeaking(false); setProgress(null) }
        if (error) reject(error)
        else resolve(success)
      }
      finishPlayback = () => finish(false, null)
      utterance.onend = () => finish(true, null)
      utterance.onerror = (event) => finish(false, new Error(`OS speech failed: ${event.error}`))
      window.speechSynthesis.speak(utterance)
    })
  } catch (error) {
    if (token === speakToken) { stopSpeaking(); throw error }
    return false
  }
}
