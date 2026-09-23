import { useState } from 'react'
import { useI18n } from '../../components/localization/i18n'
import { errorMessage } from '../../platform/diagnostics/error-details'
import { DifficultySelect } from '../../components/controls/DifficultySelect'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import { DRILL_LENGTHS, type Difficulty, type DrillLength, type ReadingScope } from '../../generated/contracts'
import { CandidateList, RequestedCaption, lengthLabel } from './CandidateList'
import { useDrillPreview } from './useDrillPreview'

const COUNT_MIN = 1
const COUNT_MAX = 20

/** Ask for phrases, and keep the ones worth practising — in the page, not over it.
 *
 * One press asks; one press per phrase adds it. There is no select-then-confirm
 * step and no dialog to dismiss: closing the panel gives back whatever was not
 * kept. Nothing is generated or added without an explicit press. */
export function AddPhrases({ scope, onAdded, onClose }: {
  scope: ReadingScope
  onAdded: () => Promise<void>
  onClose: () => void
}) {
  const tr = useI18n()
  const [source, setSource] = useState<'generate' | 'conversation'>('generate')
  const [topic, setTopic] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner')
  const [length, setLength] = useState<DrillLength>('shortPhrase')
  const [count, setCount] = useState('8')
  const offer = useDrillPreview(scope, onAdded)

  const quantity = /^\d+$/.test(count.trim()) ? Number(count.trim()) : null
  const askable = quantity !== null && quantity >= COUNT_MIN && quantity <= COUNT_MAX
  const keepable = offer.offered.filter(entry =>
    !offer.added.includes(entry.candidate.candidateId) && !entry.candidate.verified.duplicate)

  const ask = () => {
    if (!askable) return
    void offer.generate({ ...scope, topic: topic.trim() || null, count: quantity, difficulty, length })
  }
  const pick = (which: 'generate' | 'conversation') => {
    if (which === source) return
    setSource(which); offer.clear()
  }
  const leave = () => { offer.discard(); onClose() }

  return (
    <section className="drill-add" aria-label={tr("Add phrases")}>
      <div className="drill-add-head">
        <h2>{tr("Add phrases")}</h2>
        <div className="drill-sources" role="radiogroup" aria-label={tr("Where the phrases come from")}>
          <button type="button" role="radio" aria-checked={source === 'generate'} onClick={() => pick('generate')}>{tr("Generate")}</button>
          <button type="button" role="radio" aria-checked={source === 'conversation'} onClick={() => pick('conversation')}>{tr("From your chats")}</button>
        </div>
        <span className="drill-inspection-spacer" />
        <button type="button" className="btn" onClick={leave}>{tr("Done")}</button>
      </div>

      {source === 'generate' ? <>
        <div className="drill-ask">
          <label htmlFor="drill-topic">{tr("Topic")}
            <input id="drill-topic" className="field" type="text" value={topic} disabled={offer.running}
              placeholder={tr("Anything, or leave empty")} onChange={event => setTopic(event.target.value)} />
          </label>
          <label>{tr("Difficulty")}
            <DifficultySelect value={difficulty} saving={offer.running} onChange={async next => setDifficulty(next)} />
          </label>
          <label htmlFor="drill-length">{tr("Length")}
            <select id="drill-length" className="field" value={length} disabled={offer.running}
              onChange={event => {
                const picked = DRILL_LENGTHS.find(value => value === event.target.value)
                if (picked === undefined) throw new Error(`Unknown drill length: ${event.target.value}`)
                setLength(picked)
              }}>
              {DRILL_LENGTHS.map(value => <option key={value} value={value}>{tr(lengthLabel(value))}</option>)}
            </select>
          </label>
          <label htmlFor="drill-count">{tr("How many")}
            <input id="drill-count" className="field" type="number" inputMode="numeric" min={COUNT_MIN} max={COUNT_MAX}
              step={1} value={count} disabled={offer.running} onChange={event => setCount(event.target.value)} />
          </label>
          {offer.running
            ? <button type="button" className="btn" onClick={offer.cancel}>{tr("Cancel")}</button>
            : <button type="button" className="btn drill-generate" disabled={!askable} onClick={ask}>
              {tr(offer.asked ? "Generate again" : "Generate")}
            </button>}
        </div>
        {!askable && count.trim() !== '' && <p role="alert">{tr("Ask for between {value0} and {value1} phrases.", {
          value0: String(COUNT_MIN), value1: String(COUNT_MAX),
        })}</p>}
      </> : <div className="drill-ask">
        <p className="drill-candidates-note">{tr("Lines you and your partner already wrote, taken exactly as they stand. No new text is written for this.")}</p>
        {offer.running
          ? <p role="status">{tr("Reading your chats…")}</p>
          : <button type="button" className="btn drill-generate" onClick={() => void offer.loadConversation(null)}>
            {tr(offer.asked ? "Look again" : "Find lines")}
          </button>}
      </div>}

      {offer.running && source === 'generate' && <p role="status">{tr("Asking for phrases…")}</p>}
      {offer.failure != null && <p role="alert">{errorMessage(offer.failure)}</p>}
      {offer.shortfall !== null && <p role="status">{tr("Asked for {value0}, got {value1}: {value2}", {
        value0: String(offer.shortfall.requested), value1: String(offer.shortfall.produced), value2: offer.shortfall.reason,
      })}</p>}

      {offer.asked && !offer.running && offer.offered.length === 0
        && <p className="center-note">{source === 'generate'
          ? tr("Nothing came back. Ask again, or change the request.")
          : tr("No lines found in your chats for this language yet.")}</p>}

      {offer.offered.length > 0 && <>
        <div className="drill-add-actions">
          <RequestedCaption requested={offer.requested} />
          <span className="drill-inspection-spacer" />
          {keepable.length > 1 && <button type="button" className="btn" disabled={offer.adding}
            onClick={() => void offer.accept(keepable)}>
            {tr("Keep all {value0}", { value0: String(keepable.length) })}
          </button>}
        </div>
        <CandidateList offered={offer.offered} added={offer.added} adding={offer.adding}
          onKeep={entry => void offer.accept([entry])} />
        {offer.hasMore && <button type="button" className="btn drill-more" disabled={offer.running} onClick={offer.loadMore}>
          {tr("Show more")}
        </button>}
      </>}

      {offer.added.length > 0 && <p role="status" className="drill-candidates-note">
        <ToolbarIcon name="plus" size={14} />
        {tr("{value0} added to your phrases.", { value0: String(offer.added.length) })}
      </p>}
    </section>
  )
}
