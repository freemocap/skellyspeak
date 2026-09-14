import { useI18n } from '../../ui/i18n'
import { AnalysisSentence } from './AnalysisSentence'
import { useReadingPreferences } from '../../ui/ReadingPreferences'
import { TargetText } from '../../ui/TargetText'
import { memo } from 'react'
import type { StoredTurn } from '../../types'

export interface InspectTarget {
  turn: number
  side: 'me' | 'bot'
  index: number
}

/// Just the parts of a turn this pane renders. Deriving from `StoredTurn` keeps
/// this view synchronized with the canonical shape.
export type AnalysedTurn = Pick<StoredTurn, 'id' | 'user' | 'analysisState' | 'assistant' | 'userSavedGloss' | 'userTranslation'>

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
  inspect: _inspect,
  nativeLanguageName,
  showRomanization: _showRomanization,
  rtl: _rtl,
}: AnalysisContentProps) {
  const tr = useI18n()
  const { autoTranslate } = useReadingPreferences()
  const a = turn.assistant
  if (!a) return <>
    {turn.user && <AnalysisSentence label={tr("You said")} text={turn.user} gloss={turn.userSavedGloss} translation={autoTranslate ? turn.userTranslation : null} />}
    <p className="center-note">{tr("No partner reply yet.")}</p>
  </>

  return (
    <>
      {turn.analysisState === 'pending' && (
        <p className="sect-k pending">
          {tr("⟳ Analyzing grammar…")}</p>
      )}

      {turn.user && <AnalysisSentence label={tr("You said")} text={turn.user} gloss={turn.userSavedGloss} tokens={a.user_tokens} translation={autoTranslate ? turn.userTranslation ?? a.user_translation : null} />}
      <AnalysisSentence label={tr("Partner replied")} side="bot" text={a.reply} gloss={a.savedGloss} tokens={a.tokens} translation={autoTranslate ? a.translation : null} />

      {a.errors.length > 0 && (
        <div className="turn-errors">
          {a.errors.map((e, i) => (
            <div key={i}>⚠ {e}</div>
          ))}
        </div>
      )}

      {a.mechanics.length > 0 && (
        <>
          <p className="sect-k">{tr("What's happening")}</p>
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
                  <span>{tr("vs ")}{nativeLanguageName || tr("your language")}</span>
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
