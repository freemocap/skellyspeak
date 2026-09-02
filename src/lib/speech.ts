// Web Speech API wrapper: speaks text in the target language using the best
// available OS voice. No network, no keys, no cost. Voice quality is
// platform-dependent (Windows SAPI voices, Android TTS engine, ...).

import { invoke } from './tauri'
import { logError, logInfo } from './log'

let cachedVoices: SpeechSynthesisVoice[] = []

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

// Chrome/WebView populates voices asynchronously — and some engines never
// fire voiceschanged, hence the timeout safety net.
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!speechSupported()) return resolve([])
    const existing = window.speechSynthesis.getVoices()
    if (existing.length) {
      cachedVoices = existing
      return resolve(existing)
    }
    const collect = () => {
      cachedVoices = window.speechSynthesis.getVoices()
      resolve(cachedVoices)
    }
    window.speechSynthesis.addEventListener('voiceschanged', collect, { once: true })
    setTimeout(collect, 1500)
  })
}

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = cachedVoices.length ? cachedVoices : window.speechSynthesis.getVoices()
  if (!voices.length) return null
  const primary = lang.toLowerCase()
  const base = primary.split('-')[0]
  return (
    voices.find((v) => v.lang.toLowerCase() === primary) ??
    voices.find((v) => v.lang.toLowerCase().replace('_', '-') === primary) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(base)) ??
    null
  )
}

/// Speak `text` in `lang` (BCP-47, e.g. "es-ES"). Cancels any utterance in
/// progress — one voice at a time. Returns false when unsupported/empty.
export function speak(text: string, lang: string): boolean {
  if (!speechSupported() || !text.trim()) return false
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang
  const voice = pickVoice(lang)
  if (voice) u.voice = voice
  u.rate = 0.95 // a touch slower — this is a learner tool
  u.onstart = () => setSpeakingState(true)
  u.onend = () => setSpeakingState(false)
  u.onerror = () => setSpeakingState(false)
  window.speechSynthesis.speak(u)
  return true
}

/// Generation counter for speech requests. Cloud synthesis is a fetch, so
/// two clicks (or auto-speak racing a manual click) put two requests in
/// flight; `stopSpeaking` can only stop audio that is already playing, and
/// both would then play ON TOP of each other. Bumping this invalidates
/// anything still in flight.
let speakToken = 0

export function stopSpeaking(): void {
  speakToken += 1
  setSpeakingState(false)
  if (speechSupported()) window.speechSynthesis.cancel()
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio = null
  }
}

// Speaking-state ring so any UI can show a live '⏹ stop' affordance.
let speakingState = false
const speakingListeners = new Set<(v: boolean) => void>()

function setSpeakingState(v: boolean): void {
  if (speakingState === v) return
  speakingState = v
  speakingListeners.forEach((fn) => fn(v))
}

export function subscribeSpeaking(fn: (v: boolean) => void): () => void {
  speakingListeners.add(fn)
  return () => {
    speakingListeners.delete(fn)
  }
}

export function isSpeaking(): boolean {
  return speakingState
}

// ── Groq PlayAI TTS (cloud) ──────────────────────────────────────────────────

let currentAudio: HTMLAudioElement | null = null
const audioCache = new Map<string, string>() // voice|text → blob URL

interface TtsAudio {
  audio_base64: string
  mime: string
}

async function cloudTts(text: string, voice: string): Promise<string> {
  const key = `${voice}|${text}`
  const hit = audioCache.get(key)
  if (hit) return hit
  const res = await invoke<TtsAudio>('speak_text', { text, voice })
  const bytes = Uint8Array.from(atob(res.audio_base64), (ch) => ch.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: res.mime }))
  audioCache.set(key, url)
  return url
}

/// Speak via the configured engine. "groq" synthesizes cloud audio (cached
/// per voice+text) and falls back to the OS voice on any failure — loudly
/// logged, never silent.
export async function speakSmart(
  text: string,
  lang: string,
  engine: string,
  voice: string
): Promise<boolean> {
  if (!text.trim()) return false
  stopSpeaking() // also invalidates any request still in flight
  const token = speakToken
  if (engine === 'cloud') {
    try {
      const url = await cloudTts(text, voice)
      // A newer request (or a stop) superseded this one while fetching.
      if (token !== speakToken) return false
      const audio = new Audio(url)
      currentAudio = audio
      audio.onended = () => setSpeakingState(false)
      audio.onerror = () => setSpeakingState(false)
      audio.onpause = () => setSpeakingState(false)
      setSpeakingState(true)
      void audio.play()
      logInfo(`[tts] cloud voice "${voice}" — ${text.length} chars`)
      return true
    } catch (e) {
      // LOUD fallback: if cloud TTS fails the user must know they're
      // hearing the OS voice instead.
      logError('[tts] cloud synthesis FAILED — falling back to OS voice:', e)
    }
  }
  if (token !== speakToken) return false
  return speak(text, lang)
}
