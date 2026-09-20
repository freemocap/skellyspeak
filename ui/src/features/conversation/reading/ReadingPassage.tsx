import { useEffect, useRef, useState } from 'react'
import type { GlossSegment } from '../../../generated/contracts'
import { useI18n } from '../../../components/localization/i18n'
import { ErrorDetails } from '../../../components/feedback/ErrorDetails'
import { ResponseDetails } from '../../../components/feedback/ResponseDetails'
import { SavedGlossText } from '../../../components/reading/SavedGlossText'
import { useSavedReading } from '../../../components/reading/SavedReadingProvider'
import { useReadingPreferences } from '../../../components/reading/ReadingPreferences'
import { useReadingLookup, useReadingPeek, useReadingScope } from '../../../components/reading/ReadingContext'

/** Analysis uses the chat bubble and the same saved-word renderer and lookup. */
export function ReadingPassage({ text, translation, romanization, segments = [] }: {
  text: string; translation?: string | null; romanization?: string; segments?: GlossSegment[]
}) {
  const tr = useI18n(), scope = useReadingScope(), saved = useSavedReading(), peek = useReadingPeek(), lookup = useReadingLookup()
  const preferences = useReadingPreferences()
  const aidsEnabled = preferences.autoTranslate || preferences.alwaysRomanize || preferences.alwaysPronunciation
  const [wordsOverride, setWords] = useState<boolean | null>(null), [translated, setTranslated] = useState(preferences.autoTranslate)
  const [fetched, setFetched] = useState<GlossSegment[]>([]), [pending, setPending] = useState(false), [error, setError] = useState<unknown>(null)
  const local = (segments.length ? segments : scope ? saved(text, scope) : []).filter(part => part.kind === 'gloss')
  const cached = scope ? peek({...scope, text, speech:false})?.gloss?.segments ?? [] : []
  const resolved = [...local, ...[...cached, ...fetched].filter(part => !local.some(item => item.start < part.end && item.end > part.start))]
  // Prefer one complete cached/fetched result over duplicating equivalent anchors.
  const unique = resolved.filter((part, index) => !resolved.slice(0,index).some(item => item.start < part.end && item.end > part.start))
  const words = wordsOverride ?? (aidsEnabled && unique.length > 0)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => { setWords(null) }, [preferences.autoTranslate, preferences.alwaysRomanize, preferences.alwaysPronunciation])
  useEffect(() => setTranslated(preferences.autoTranslate), [preferences.autoTranslate])
  async function toggleWords() {
    setWords(!words)
    if (words || pending || unique.length || !lookup || !scope) return
    const controller = new AbortController(); request.current = controller
    setPending(true); setError(null)
    try { const result = await lookup({...scope, text, speech:false}, controller.signal); if (!controller.signal.aborted) setFetched(result.gloss?.segments ?? []) }
    catch (failure) { if (!controller.signal.aborted) setError(failure) }
    finally { if (!controller.signal.aborted) setPending(false) }
  }
  return <div className="reading-passage">
    <div className="msg chat-message bot" dir="auto">
      <SavedGlossText text={text} segments={unique} showAids={words} revealAids={wordsOverride === true} />
      {translated && translation && <div className="trans" dir="auto">{translation}</div>}
      {preferences.alwaysRomanize && romanization && !(words && unique.some(part => part.romanization)) && <div className="wroman" dir="ltr">{romanization}</div>}
    </div>
    <div className="message-actions">
      {translation && <button type="button" className="message-translate" aria-expanded={translated} onClick={() => setTranslated(!translated)}>{tr('Translate')}</button>}
      <button type="button" className="message-translate" aria-expanded={words} disabled={pending} onClick={() => void toggleWords()}>{tr('Word by word')}</button>
    </div>
    {error != null && <ErrorDetails label={tr('Word meanings')} errorKey={String(error)}><ResponseDetails value={error} /></ErrorDetails>}
  </div>
}
