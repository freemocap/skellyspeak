import { ReadingPreferencesProvider, useReadingPreferences } from './ReadingPreferences'
import { createContext, useCallback, Fragment, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { GuidedToken, Settings } from '../types'
import { TokenSpan } from './TokenSpan'
import { invoke } from '../lib/tauri'
import { WordInsightModal } from './WordInsightModal'

export const ReadingSentenceContext = createContext<string | null>(null)

const ReadingContext = createContext<{
  language: string
  nativeLanguage: string
  prepare: (text: string, sentence: string) => Promise<GuidedToken[]>
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
  const requests = useMemo(() => new Map<string, Promise<GuidedToken[]>>(), [settings?.target_language, settings?.native_language])
  const prepare = useCallback((text: string, sentence: string): Promise<GuidedToken[]> => {
    const key = JSON.stringify([text, sentence])
    let request = requests.get(key)
    if (!request) {
      request = invoke<{ tokens: GuidedToken[] }>('annotate_text', { text, sentence }).then(result => {
        if (!result.tokens?.length) throw new Error('Text annotation returned no tokens')
        return result.tokens
      }).catch((error: unknown) => { requests.delete(key); throw error })
      if (requests.size >= 256) requests.delete(requests.keys().next().value!)
      requests.set(key, request)
    }
    return request
  }, [requests])
  return <ReadingPreferencesProvider settings={settings}><ReadingContext value={{ prepare, nativeLanguage: settings?.native_language ?? 'en', language: settings?.target_language ?? 'en', inspect: (word, sentence) => setInsight({ word, sentence }) }}>
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
  const [prepared, setPrepared] = useState<GuidedToken[]>([])
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const needsPreparation = !savedTokens.length && /[\p{L}\p{N}]/u.test(text)
  useEffect(() => {
    if (!needsPreparation || !reading) return
    let active = true
    setError(null)
    void reading.prepare(text, sentence).then(tokens => { if (active) setPrepared(tokens) })
      .catch((reason: unknown) => { if (active) setError(String(reason)) })
    return () => { active = false }
  }, [text, sentence, reading?.prepare, needsPreparation, attempt])
  const nativeUpdateRequired = error?.includes("Command annotate_text not found") ?? false
  const tokens = savedTokens.length ? savedTokens : prepared
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
  return <span className="target-text" dir="auto" aria-busy={needsPreparation && !tokens.length && !error}>{segments.map(({ segment, index, isWordLike, saved }) => {
    if (!isWordLike) return <Fragment key={index}>{segment}</Fragment>
    const token: GuidedToken = saved ? saved : { text: segment, gloss: null, pronunciation: null, romanization: null, pos: null, notable: false }
    const inspect = (): void => {
      if (!reading) throw new Error('Word inspection requires the reading provider')
      reading.inspect(segment, sentence)
    }
    const tap = (): void => {
      if (!token.gloss) return
      setRevealed(previous => { const next = new Set(previous); if (next.has(index)) next.delete(index); else next.add(index); return next })
    }
    return <Fragment key={`${text}:${index}`}><TokenSpan key={`${text}:${index}`} tok={token} interactive={interactive && !!saved} revealed={revealed.has(index)} hasTranslation={!!token.gloss}
      showRomanization={true} alwaysRomanize={alwaysRomanize} alwaysPronunciation={alwaysPronunciation}
      onTap={tap}
      onHold={inspect} onInspect={event => { event.preventDefault(); inspect() }} onDragStart={() => {}} onDragOver={() => {}} /></Fragment>
  })}{error && <span className="word-annotation-error" role="alert" dir="auto">{nativeUpdateRequired ? "Word help requires an updated native app. Rebuild and reopen SkellySpeak; refreshing this page is not enough." : error} {interactive && !nativeUpdateRequired && <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry word annotations</button>}</span>}</span>
}
