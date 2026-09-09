import { useReadingPreferences } from '../ReadingPreferences'
import { needsSpaceBetween } from '../../lib/token-spacing'
import { AnnotatedText, TargetText } from '../TargetText'
import { memo } from 'react'
import type { GuidedToken, StoredTurn } from '../../types'

export interface InspectTarget {
  turn: number
  side: 'me' | 'bot'
  index: number
}

/// Just the parts of a turn this pane renders. Deriving from `StoredTurn` keeps
/// this view synchronized with the canonical shape.
export type AnalysedTurn = Pick<StoredTurn, 'id' | 'user' | 'analysisState' | 'assistant'>

interface AnalysisContentProps {
  turn: AnalysedTurn
  inspect: InspectTarget | null
  nativeLanguageName: string
  showRomanization: boolean
  rtl: boolean
}

/// The pinned turn's full breakdown: learner words, tutor words, per-token
/// gloss lists, grammar mechanics, and the analysis Q&A thread.
export const AnalysisContent = memo(function AnalysisContent({
  turn,
  inspect,
  nativeLanguageName,
  showRomanization,
  rtl,
}: AnalysisContentProps) {
  const { autoTranslate, alwaysRomanize } = useReadingPreferences()
  const a = turn.assistant
  if (!a) {
    return (
      <p className="center-note">
        The breakdown of the tutor&apos;s latest reply lands here.
      </p>
    )
  }

  const highlighted = (side: 'me' | 'bot', i: number) =>
    inspect?.turn === turn.id && inspect?.side === side && inspect.index === i
      ? 'inspected'
      : ''

  const tokenSentence = (tokens: GuidedToken[]) => (
    <p className={rtl ? 'sentence rtl' : 'sentence'}><AnnotatedText text={tokens.map((token, index) => `${index > 0 && needsSpaceBetween(tokens[index - 1].text, token.text) ? ' ' : ''}${token.text}`).join('')} tokens={tokens} /></p>
  )

  const glossList = (tokens: GuidedToken[], side: 'me' | 'bot') => (
    <div className="gloss">
      {tokens.map((tok, i) => (
        <div key={i} className={`tok ${tok.notable ? 'key' : ''} ${highlighted(side, i)}`}>
          <span className="sp" dir="auto"><AnnotatedText text={tok.text} tokens={[tok]} /></span>
          {alwaysRomanize && showRomanization && tok.romanization && (
            <span className="proman">{tok.romanization}</span>
          )}
          {tok.gloss && <span className="gl">{tok.gloss}</span>}
          {tok.pos && <span className="po">{tok.pos}</span>}
        </div>
      ))}
    </div>
  )

  return (
    <>
      {turn.analysisState === 'pending' && (
        <p className="sect-k" style={{ color: 'var(--steel)', marginBottom: 12 }}>
          ⟳ Analyzing grammar…
        </p>
      )}

      <p className="sect-k" style={{ marginBottom: 8 }}>
        You said
      </p>
      {a.user_tokens && a.user_tokens.length > 0 ? (
        tokenSentence(a.user_tokens)
      ) : turn.user ? (
        <p className={rtl ? 'sentence rtl' : 'sentence'}><TargetText text={turn.user} /></p>
      ) : null}
      {autoTranslate && a.user_translation && <p className="trans-d">{a.user_translation}</p>}

      <p className="sect-k" style={{ marginBottom: 8 }}>
        Tutor replied
      </p>
      {a.tokens.length > 0
        ? tokenSentence(a.tokens)
        : <p className="sentence"><TargetText text={a.reply} /></p>}
      {autoTranslate && a.translation && <p className="trans-d">{a.translation}</p>}

      {a.tokens.length > 0 && (
        <>
          <p className="sect-k">Tutor words</p>
          {glossList(a.tokens, 'bot')}
        </>
      )}

      {a.user_tokens && a.user_tokens.length > 0 && (
        <>
          <p className="sect-k">Your words</p>
          {glossList(a.user_tokens, 'me')}
        </>
      )}

      {a.errors.length > 0 && (
        <div className="turn-errors">
          {a.errors.map((e, i) => (
            <div key={i}>⚠ {e}</div>
          ))}
        </div>
      )}

      {a.mechanics.length > 0 && (
        <>
          <p className="sect-k">What&apos;s happening</p>
          {a.mechanics.map((mech) => (
            <div key={mech.title} className="exp">
              <div className="exp-top">
                <span className="exp-title">{mech.title}</span>
                {mech.cefr && <span className="exp-cefr">{mech.cefr}</span>}
              </div>
              <p className="exp-body">{mech.body}</p>
              {mech.example && <p className="exp-ex"><TargetText text={mech.example} /></p>}
              {mech.contrast && (
                <p className="exp-vs">
                  <span>vs {nativeLanguageName || 'your language'}</span>
                  {mech.contrast}
                </p>
              )}
            </div>
          ))}
        </>
      )}

    </>
  )
})
