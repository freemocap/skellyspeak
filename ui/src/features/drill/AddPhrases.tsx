import { useState } from 'react'
import { useI18n } from '../../components/localization/i18n'
import { errorMessage } from '../../platform/diagnostics/error-details'
import { DetailDialog } from '../../components/dialogs/DetailDialog'
import { DifficultySelect } from '../../components/controls/DifficultySelect'
import { ReadingScopeContext } from '../../components/reading/ReadingContext'
import { ReadingLanguageScope } from '../../components/reading/ReadingLanguageScope'
import { DRILL_LENGTHS, type Difficulty, type DrillGenerationInput, type DrillLength, type ReadingScope } from '../../generated/contracts'
import { CandidateList, RequestedCaption, lengthLabel } from './CandidateList'
import { useDrillPreview } from './useDrillPreview'

const COUNT_MIN = 1
const COUNT_MAX = 20

/** Ask for phrases, and keep the ones worth practising.
 *
 * One list of what to add: the lengths, and the learner's own past chats as a
 * source beside them. One press asks, one press per phrase keeps it. Nothing is
 * requested or added without an explicit press. */
export function AddPhrases({ scope, onAdded, onClose }: {
  scope: ReadingScope
  onAdded: () => Promise<void>
  onClose: () => void
}) {
  const tr = useI18n()
  const [lengths, setLengths] = useState<DrillLength[]>(['shortPhrase'])
  const [chats, setChats] = useState(false)
  const [topic, setTopic] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner')
  const [count, setCount] = useState('8')
  const offer = useDrillPreview(scope, onAdded)

  const quantity = /^\d+$/.test(count.trim()) ? Number(count.trim()) : null
  const counted = quantity !== null && quantity >= COUNT_MIN && quantity <= COUNT_MAX
  const askable = (lengths.length > 0 && counted) || (lengths.length === 0 && chats)
  const keepable = offer.offered.filter(entry =>
    !offer.added.includes(entry.candidate.candidateId) && !entry.candidate.verified.duplicate)

  const ask = () => {
    if (!askable) return
    // One request per length: the contract carries a single length, so a mixed
    // ask is several requests sharing out the quantity between them.
    const inputs: DrillGenerationInput[] = lengths.map((length, index) => ({
      ...scope,
      topic: topic.trim() || null,
      count: Math.floor((quantity ?? 0) / lengths.length) + (index < (quantity ?? 0) % lengths.length ? 1 : 0),
      difficulty,
      length,
    })).filter(input => input.count > 0)
    void offer.generate(inputs, chats)
  }
  // Ticking order never changes the requests: the list keeps the contract's own
  // order, so the same ticks always split the quantity the same way.
  const toggleLength = (value: DrillLength) => setLengths(current =>
    DRILL_LENGTHS.filter(entry => entry === value ? !current.includes(entry) : current.includes(entry)))
  const leave = () => { offer.discard(); onClose() }

  return (
    <DetailDialog title={tr("Add phrases")} size="wide" onClose={leave}>
      <ReadingScopeContext value={scope}><ReadingLanguageScope language={scope.language} variety={scope.variety}>
        <h2>{tr("Add phrases")}</h2>
        <div className="drill-add">

          <div className="drill-add-ask">
            <fieldset className="drill-add-options">
              <legend>{tr("What to add")}</legend>
              {DRILL_LENGTHS.map(value => (
                <div key={value} className="check-row">
                  <label className="check-label">
                    <input type="checkbox" checked={lengths.includes(value)} disabled={offer.running}
                      onChange={() => toggleLength(value)} />
                    {tr(lengthLabel(value))}
                  </label>
                </div>
              ))}
              <div className="check-row drill-add-source">
                <label className="check-label">
                  <input type="checkbox" checked={chats} disabled={offer.running}
                    onChange={() => setChats(current => !current)} />
                  {tr("Lines from your chats")}
                </label>
              </div>
            </fieldset>

            <div className="form-row">
              <label htmlFor="drill-topic">{tr("Topic (optional)")}</label>
              <input id="drill-topic" type="search" value={topic} disabled={offer.running}
                onChange={event => setTopic(event.target.value)} />
            </div>
            <label className="form-row drill-add-difficulty">{tr("Difficulty")}
              <DifficultySelect value={difficulty} saving={offer.running} onChange={async next => setDifficulty(next)} />
            </label>
            <div className="form-row">
              <label htmlFor="drill-count">{tr("How many")}</label>
              <input id="drill-count" type="number" inputMode="numeric" min={COUNT_MIN} max={COUNT_MAX} step={1}
                value={count} disabled={offer.running} onChange={event => setCount(event.target.value)} />
            </div>

            {offer.running
              ? <button type="button" className="btn" onClick={offer.cancel}>{tr("Cancel")}</button>
              : <button type="button" className="btn primary" disabled={!askable} onClick={ask}>
                {tr(offer.asked ? "Generate again" : "Generate")}
              </button>}
            {lengths.length > 0 && !counted && count.trim() !== ''
              && <p role="alert">{tr("Ask for between {value0} and {value1} phrases.", {
                value0: String(COUNT_MIN), value1: String(COUNT_MAX),
              })}</p>}
            {lengths.length === 0 && !chats && <p role="alert">{tr("Pick at least one thing to add.")}</p>}
          </div>

          <div className="drill-add-results">
            {offer.running && <p role="status">{tr("Asking for phrases…")}</p>}
            {offer.failure != null && <p role="alert">{errorMessage(offer.failure)}</p>}
            {offer.shortfall !== null && <p role="status">{tr("Asked for {value0}, got {value1}: {value2}", {
              value0: String(offer.shortfall.requested), value1: String(offer.shortfall.produced), value2: offer.shortfall.reason,
            })}</p>}

            {offer.asked && !offer.running && offer.offered.length === 0
              && <p className="center-note">{tr("Nothing came back. Ask again, or change the request.")}</p>}

            {offer.offered.length > 0 && <>
              <div className="drill-add-actions">
                <RequestedCaption requested={offer.requested} chats={offer.fromChats} />
                <span className="drill-inspection-spacer" />
                {keepable.length > 1 && <button type="button" className="btn" disabled={offer.adding}
                  onClick={() => void offer.accept(keepable)}>
                  {tr("Keep all {value0}", { value0: String(keepable.length) })}
                </button>}
              </div>
              <CandidateList offered={offer.offered} added={offer.added} adding={offer.adding}
                onKeep={entry => void offer.accept([entry])} />
              {offer.hasMore && <button type="button" className="btn drill-more" disabled={offer.running}
                onClick={offer.loadMore}>{tr("Show more")}</button>}
            </>}
          </div>

        </div>
      </ReadingLanguageScope></ReadingScopeContext>
    </DetailDialog>
  )
}
