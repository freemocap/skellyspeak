import { ReadingPreferencesProvider, useReadingPreferences } from './ReadingPreferences'
import { createContext, Fragment, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { GuidedToken, Settings } from '../types'
import { TokenSpan } from './TokenSpan'
import { WordInsightModal } from './WordInsightModal'

export const ReadingSentenceContext = createContext<string | null>(null)

const ReadingContext = createContext<{
  language: string
  nativeLanguage: string
  inspect: (word: string, sentence: string) => void
} | null>(null)

export function ReadingProvider({ settings, children }: { settings: Settings | null; children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--reading-scale', String((settings?.text_size ?? 100) / 100))
    root.style.setProperty('--word-spacing', `${settings?.text_spacing ?? 2}px`)
    return () => { root.style.removeProperty('--reading-scale'); root.style.removeProperty('--word-spacing') }
  }, [settings?.text_size, settings?.text_spacing])
  const [insight, setInsight] = useState<{ word: string; sentence: string } | null>(null)
  return <ReadingPreferencesProvider settings={settings}><ReadingContext value={{ nativeLanguage: settings?.native_language ?? 'en', language: settings?.target_language ?? 'en', inspect: (word, sentence) => setInsight({ word, sentence }) }}>
    {children}
    {insight && <WordInsightModal word={insight.word} sentence={insight.sentence} onClose={() => setInsight(null)} />}
  </ReadingContext></ReadingPreferencesProvider>
}

/** Target text without saved annotations still supports contextual word inspection. */
export function TargetText({ text, interactive = true }: { text: string; interactive?: boolean }) {
  return <AnnotatedText text={text} tokens={[]} interactive={interactive} />
}

export function AnnotatedText({ text, tokens, interactive = true }: { text: string; tokens: GuidedToken[]; interactive?: boolean }) {
  const reading = useContext(ReadingContext)
  const sentence = useContext(ReadingSentenceContext) ?? text
  return <TargetTextContent key={`${reading?.language}:${reading?.nativeLanguage}:${sentence}:${text}`} text={text} tokens={tokens} interactive={interactive} />
}

function TargetTextContent({ text, tokens: savedTokens, interactive }: { text: string; tokens: GuidedToken[]; interactive: boolean }) {
  const { alwaysPronunciation, alwaysRomanize } = useReadingPreferences()
  const sentence = useContext(ReadingSentenceContext) ?? text
  const reading = useContext(ReadingContext)
  const [revealed, setRevealed] = useState<Set<number>>(new Set())
  const tokens = savedTokens
  const segments = useMemo(() => {
    if (tokens.length === 0) return Array.from(new Intl.Segmenter(reading?.language, { granularity: 'word' }).segment(text), segment => ({ ...segment, saved: null }))
    let cursor = 0
    const entries = tokens.flatMap(token => {
      const index = text.indexOf(token.text, cursor)
      if (index < 0) throw new Error('Saved token is missing from its source text')
      const prefix = { segment: text.slice(cursor, index), index: cursor, isWordLike: false, saved: null }
      cursor = index + token.text.length
      return [...(prefix.segment ? [prefix] : []), { segment: token.text, index, isWordLike: /[\p{L}\p{N}]/u.test(token.text), saved: token }]
    })
    if (cursor < text.length) entries.push({ segment: text.slice(cursor), index: cursor, isWordLike: false, saved: null })
    return entries
  }, [text, tokens, reading?.language])
  return <span className="target-text" dir="auto">{segments.map(({ segment, index, isWordLike, saved }) => {
    if (!isWordLike) return <Fragment key={index}>{segment}</Fragment>
    const token: GuidedToken = saved ? saved : { text: segment, gloss: null, pronunciation: null, romanization: null, pos: null, notable: false }
    const inspect = (): void => {
      if (!reading) throw new Error('Word inspection requires the reading provider')
      reading.inspect(segment, sentence)
    }
    const tap = (): void => {
      if (!saved) { inspect(); return }
      if (!token.gloss) return
      setRevealed(previous => { const next = new Set(previous); if (next.has(index)) next.delete(index); else next.add(index); return next })
    }
    return <Fragment key={`${text}:${index}`}><TokenSpan key={`${text}:${index}`} tok={token} interactive={interactive} inspectOnTap={!saved} revealed={revealed.has(index)} hasTranslation={!!token.gloss}
      showRomanization={true} alwaysRomanize={alwaysRomanize} alwaysPronunciation={alwaysPronunciation}
      onTap={tap}
      onHold={inspect} onInspect={event => { event.preventDefault(); inspect() }} onDragStart={() => {}} onDragOver={() => {}} /></Fragment>
  })}</span>
}
