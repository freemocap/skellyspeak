import { useCallback, useEffect, useState } from 'react'
import { invoke, isTauri } from '../../lib/tauri'
import { CoachFeed } from './CoachFeed'
import { AnalysisContent, type AnalysedTurn, type InspectTarget } from './AnalysisContent'
import { usePersistentToggle } from '../../hooks/useSteering'
import { reportFault } from '../../lib/faults'
import { Markdown } from '../../lib/markdown'

interface CoachTurn {
  id: number
  user: string | null
  coach?: {
    comprehensibility: number
    grammar: number
    remark: string
    used_target: string[]
    used_native: string[]
    corrections: { said: string; corrected: string; kind: string; explanation: string }[]
  }
  coachError?: string
}

/// The unified right panel: tabs for Coach (feedback + private thread) and
/// Analysis (pinned-turn breakdown). One pane, two views; the coach thread
/// is persistent, the analysis pane is the same breakdown the learner
/// already knows.
export function CoachAnalysisPanel({
  turns,
  targetLangCode,
  nativeLangCode,
  pinnedTurn,
  inspect,
  nativeLanguageName,
  showRomanization,
  rtl,
  threadReload,
  buildCoachContext,
}: {
  turns: CoachTurn[]
  targetLangCode: string
  nativeLangCode: string
  pinnedTurn: AnalysedTurn | null
  inspect: InspectTarget | null
  nativeLanguageName: string
  showRomanization: boolean
  rtl: boolean
  threadReload: number
  buildCoachContext: () => string
}) {
  const [tab, setTab] = useState<'coach' | 'analysis'>('coach')
  // The thread competes for height with the per-message coach feed; collapse
  // it and the feedback stays readable on a short pane.
  const { open: threadOpen, toggle: toggleThread } = usePersistentToggle(
    'skellyspeak_coach_thread',
    true
  )
  const [thread, setThread] = useState<{ role: string; content: string }[]>([])
  const [inputValue, setInputValue] = useState('')
  const [thinking, setThinking] = useState(false)

  useEffect(() => {
    if (!isTauri) return
    void invoke<{ role: string; content: string }[]>('get_coach_thread')
      .then(setThread)
      .catch((e: unknown) => reportFault('Coach history', e))
  }, [threadReload])

  const coachAsk = useCallback(
    async (question: string) => {
      const q = question.trim()
      if (!q || thinking) return
      setThinking(true)
      setThread((t) => [...t, { role: 'user', content: q }])
      try {
        const res = await invoke<{ reply: string }>('coach_ask', {
          question: q,
          context: buildCoachContext(),
        })
        setThread((t) => [...t, { role: 'coach', content: res.reply }])
      } catch (e) {
        reportFault('Coach', e)
        setThread((t) => [...t, { role: 'coach', content: `⚠ ${String(e)}` }])
      } finally {
        setThinking(false)
      }
    },
    [thinking, buildCoachContext]
  )

  const coachClear = useCallback(() => {
    void invoke('coach_thread_clear').catch((e: unknown) => reportFault('Clearing coach history', e))
    setThread([])
  }, [])

  return (
    <>
      <div className="panel-tabs">
        <button
          type="button"
          className={`panel-tab ${tab === 'coach' ? 'active' : ''}`}
          onClick={() => setTab('coach')}
        >
          Coach
        </button>
        <button
          type="button"
          className={`panel-tab ${tab === 'analysis' ? 'active' : ''}`}
          onClick={() => setTab('analysis')}
        >
          Analysis
        </button>
      </div>
      {tab === 'coach' && (
        <>
          <CoachFeed
            turns={turns}
            targetLangCode={targetLangCode}
            nativeLangCode={nativeLangCode}
          />
          <div className="coach-thread-head">
            <span>your thread{thread.length > 0 ? ` · ${thread.length}` : ''}</span>
            <button
              type="button"
              onClick={toggleThread}
              aria-expanded={threadOpen}
              title={threadOpen ? 'Hide the thread' : 'Show the thread'}
            >
              {threadOpen ? '▾' : '▸'}
            </button>
          </div>
          {threadOpen && (
            <div className="coach-thread">
              {thread.map((m, i) => (
                <div key={i} className={`coach-msg ${m.role}`}>
                  <Markdown text={m.content} />
                </div>
              ))}
              {thinking && <div className="coach-msg coach">⟳ thinking…</div>}
            </div>
          )}
          <form
            className="coach-input-row"
            onSubmit={(e) => {
              e.preventDefault()
              void coachAsk(inputValue)
              setInputValue('')
            }}
          >
            <input
              className="coach-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask the coach…"
              disabled={!isTauri}
            />
            <button type="submit" className="coach-send" disabled={!inputValue.trim() || thinking}>
              ↑
            </button>
            <button type="button" className="coach-clear" title="Clear coach thread" onClick={coachClear}>
              ⌫
            </button>
          </form>
        </>
      )}
      {tab === 'analysis' && (
        <div className="analysis-scroll">
          {pinnedTurn ? (
            <AnalysisContent
              turn={pinnedTurn as never}
              inspect={inspect}
              nativeLanguageName={nativeLanguageName}
              showRomanization={showRomanization}
              rtl={rtl}
            />
          ) : (
            <p className="center-note">
              The breakdown of the tutor&apos;s latest reply lands here.
            </p>
          )}
        </div>
      )}
    </>
  )
}
