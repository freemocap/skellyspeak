import { useEffect, useState } from 'react'
import { invoke } from '../lib/tauri'
import { openOverlay } from '../lib/back'
import { logError } from '../lib/log'

export interface WordInsight {
  lemma: string
  pos: string
  form: string
  role: string
  usage: string
}

function InsightRow({ k, v }: { k: string; v: string }) {
  if (!v.trim()) return null
  return (
    <div className="insight-row">
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </div>
  )
}

/// Deep word analysis, opened by press-and-hold (or click in the Analysis
/// pane) on any word. Opens immediately, hydrates via `word_insight`.
export function WordInsightModal({
  word,
  sentence,
  onClose,
}: {
  word: string
  sentence: string
  onClose: () => void
}) {
  const [insight, setInsight] = useState<WordInsight | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => openOverlay(onClose), [onClose])
  useEffect(() => {
    let alive = true
    void invoke<WordInsight>('word_insight', { word, sentence })
      .then((w) => {
        if (alive) setInsight(w)
      })
      .catch((e) => {
        logError('[insight] failed:', e)
        if (alive) setError(String(e).replace(/^Error:\s*/, ''))
      })
    return () => {
      alive = false
    }
  }, [word, sentence])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="insight-modal"
        onClick={(e) => e.stopPropagation()}
        onFocusCapture={(e) => {
          const t = e.target as HTMLElement
          if (t.tagName === 'INPUT' || t.tagName === 'SELECT') {
            t.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
          }
        }}
      >
        <div className="insight-head">
          <span className="insight-word">{word}</span>
          <button type="button" className="popup-x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="insight-sentence">{sentence}</p>
        {!insight && !error && <p className="center-note" style={{ padding: '20px 0' }}>⟳ Analyzing…</p>}
        {error && <div className="turn-errors">⚠ {error}</div>}
        {insight && (
          <div className="insight-body">
            <InsightRow k="Lemma" v={insight.lemma} />
            <InsightRow k="Part of speech" v={insight.pos} />
            <InsightRow k="Form" v={insight.form} />
            <InsightRow k="Role in sentence" v={insight.role} />
            <InsightRow k="Usage" v={insight.usage} />
          </div>
        )}
      </div>
    </div>
  )
}
