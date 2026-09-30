import { useEffect, useId, useRef, useState } from 'react'
import { DetailDialog } from '../../components/dialogs/DetailDialog'
import { ErrorNotice } from '../../components/feedback/ErrorNotice'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import { difficultyLabel } from '../../components/controls/DifficultySelect'
import { TargetMessage } from '../../components/reading/TargetMessage'
import { useI18n } from '../../components/localization/i18n'
import { messageKey } from '../../domain/localization'
import { errorMessage } from '../../platform/diagnostics/error-details'
import { reportFault } from '../../platform/diagnostics/faults'
import { acceptDrillItems, discardDrillPreview, previewDrillItems } from '../../platform/ipc/drill-generation'
import { languageFor } from '../../platform/ipc/tauri'
import type { Difficulty, ReadingScope } from '../../generated/contracts'
import { AddToPracticeHint } from './AddToPracticeHint'

/// How many short phrases one level's button generates and keeps.
const STARTER_COUNT = 8

/// The levels offered, easiest first, each with one line on what it holds and
/// its button's own words.
const LEVELS = [
  { level: 'absolute_zero', description: messageKey('Single words and greetings'), action: messageKey('Add 8 absolute zero phrases') },
  { level: 'beginner', description: messageKey('Everyday short phrases'), action: messageKey('Add 8 beginner phrases') },
  { level: 'intermediate', description: messageKey('Fuller sentences to ask and explain'), action: messageKey('Add 8 intermediate phrases') },
  { level: 'advanced', description: messageKey('Longer, more natural speech'), action: messageKey('Add 8 advanced phrases') },
] as const satisfies readonly { level: Difficulty; description: string; action: string }[]

/** The first-visit starter: one press generates a level's short phrases, keeps
 * every new one as a practice card and hands back the first card to open.
 *
 * Absolute zero shows the language's authored greeting as its sample; the other
 * levels have no authored sample phrases in the language configuration yet.
 * Each level's button sits at the foot of its card, so the buttons line up
 * whatever the cards above them hold. */
export function QuickStart({ scope, showAgain, onShowAgain, onAdded, onClose }: {
  scope: ReadingScope
  showAgain: boolean
  onShowAgain: () => void
  onAdded: (firstId: string) => Promise<void>
  onClose: () => void
}) {
  const tr = useI18n()
  const language = languageFor(scope.language, scope.variety ?? undefined)
  if (!language) throw new Error(`No language configuration for ${scope.language} (${scope.variety ?? 'no variety'}).`)
  const [pending, setPending] = useState<Difficulty | null>(null)
  const [failure, setFailure] = useState<{ level: Difficulty; error: unknown } | null>(null)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => { request.current?.abort(); request.current = null }, [])

  const start = async (level: Difficulty) => {
    const controller = new AbortController()
    request.current = controller
    setPending(level); setFailure(null)
    try {
      const preview = await previewDrillItems({ ...scope, topic: null, count: STARTER_COUNT, difficulty: level, length: 'shortPhrase' }, controller.signal)
      const fresh = preview.candidates.filter(candidate => !candidate.verified.duplicate).map(candidate => candidate.candidateId)
      if (fresh.length === 0) throw new Error(`The ${level} request returned no new phrases (${preview.candidates.length} offered, all already practice cards).`)
      const added = await acceptDrillItems(preview.requestId, fresh)
      void discardDrillPreview(preview.requestId).catch(error => reportFault('Discarding a starter preview', error))
      if (added.length === 0) throw new Error('Keeping the starter phrases returned no practice cards.')
      await onAdded(added[0].id)
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setFailure({ level, error })
    } finally {
      if (request.current === controller) { request.current = null; setPending(null) }
    }
  }

  const described = useId()
  return (
    <DetailDialog title={tr("Start practising")} size="wide" className="drill-starter" onClose={onClose}>
      <h2>{tr("Start practising")}</h2>
      <ul className="drill-starter-levels">
        {LEVELS.map(({ level, description, action }) => (
          <li key={level} className="drill-starter-level">
            {/* A sample shares the name's row where the card is wide enough, so
                the cards beside it are not left with an empty band. */}
            <div className="drill-starter-about">
              <header className="drill-starter-head">
                <h3><LevelBars level={level} />{tr(difficultyLabel(level))}</h3>
                <p id={`${described}-${level}`}>{tr(description)}</p>
              </header>
              {level === 'absolute_zero' && <div className="drill-starter-sample">
                <TargetMessage provenance={null} layout="compact" text={language.greeting.text} segments={[]}
                  segmentsKey={`starter-${language.code}`} translation={null} romanization={language.greeting.romanized} pronunciation={null}
                  translateLabel={null} segmentsPending={false} lookupWords status={null} annotation={null} speech={null} analysis={null}
                  focused={false} rtl={language.direction === 'rtl'} />
              </div>}
            </div>
            {/* A failure sits above the button, so the buttons stay in line. */}
            <div className="drill-starter-do">
              {failure?.level === level && <ErrorNotice as="p" error={failure.error} onRetry={() => start(level)}>{errorMessage(failure.error)}</ErrorNotice>}
              {pending === level
                ? <p className="drill-starter-busy" role="status"><span className="drill-starter-spinner" aria-hidden="true" />{tr("Adding phrases…")}</p>
                : <button type="button" className="btn outline drill-starter-action" aria-describedby={`${described}-${level}`}
                  disabled={pending !== null} onClick={() => void start(level)}>
                  <ToolbarIcon name="deck-add" size={17} />{tr(action)}</button>}
            </div>
          </li>
        ))}
      </ul>
      <AddToPracticeHint lead={<ToolbarIcon name="idea" size={16} />}
        message={messageKey("Tip: click {value0} on any phrase in the app to add it to your practice cards.")} />
      <div className="drill-starter-foot">
        <div className="check-row">
          <label className="check-label"><input type="checkbox" checked={!showAgain} onChange={onShowAgain} />{tr("Don’t show this again")}</label>
        </div>
        <button type="button" className="btn" onClick={onClose}>{tr("Close")}</button>
      </div>
    </DetailDialog>
  )
}

/// Four bars, filled up to the level: a quiet mark of how far along it sits.
function LevelBars({ level }: { level: Difficulty }) {
  const filled = LEVELS.findIndex(entry => entry.level === level) + 1
  if (filled === 0) throw new Error(`No starter level for ${level}.`)
  return <span className="drill-starter-bars" aria-hidden="true">
    {LEVELS.map((entry, index) => <span key={entry.level} data-filled={index < filled} />)}
  </span>
}
