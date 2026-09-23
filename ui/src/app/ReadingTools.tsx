import { AskCoachContext } from '../components/learning/AskCoachButton'
import { useNavigationStore } from '../state/navigation/navigation'
import { ReadingScopeContext, type ReadingScope } from '../components/reading/ReadingContext'
import { useMemo, useRef, type ReactNode } from 'react'
import type { Settings } from '../types'
import { ReadingHelp } from '../components/reading/ReadingHelp'
import { ReadingProvider } from '../components/reading/TargetText'
import { readSelection, readingActivity } from '../platform/ipc/reading'
import { speakSelection } from '../platform/audio/reading-speech'
import { languages } from '../platform/ipc/tauri'
import type { ReadingServices } from '../components/reading/ReadingContext'

export function ReadingTools({ settings, defaultScope, onAsk, children }: { settings: Settings | null; defaultScope?: ReadingScope; onAsk?: ((question: string) => void) | null; children: ReactNode }) {
  const playback = useRef(settings); playback.current = settings
  const services = useMemo<ReadingServices>(() => ({
    read: readSelection, activity: readingActivity,
    // Reading tools show the receipt, never the audio it came with.
    speak: (input, signal, onPlayback) => speakSelection(input, signal, onPlayback,
      playback.current?.tts_rate ?? 1, (playback.current?.master_volume ?? 100) * (playback.current?.voice_volume ?? 100) / 10000)
      .then(result => result.receipt),
  }), [])
  const reading = <ReadingHelp key={settings?.scope?.sessionId ?? "startup"} services={services} languages={settings || defaultScope ? languages() : []}>{children}</ReadingHelp>
  const ask = (question: string) => {
    useNavigationStore.getState().draftReadingQuestion(question)
    // Preserve unsaved settings: defer navigation until the settings dialog closes.
    if (!useNavigationStore.getState().settingsBusy) useNavigationStore.getState().openPractice('panel')
  }
  return <AskCoachContext value={onAsk === undefined ? ask : onAsk}><ReadingProvider settings={settings}>{defaultScope ? <ReadingScopeContext value={defaultScope}>{reading}</ReadingScopeContext> : reading}</ReadingProvider></AskCoachContext>
}
