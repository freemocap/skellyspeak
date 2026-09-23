import { useState } from 'react'
import { useI18n } from '../../components/localization/i18n'
import { errorMessage } from '../../platform/diagnostics/error-details'
import { DetailDialog } from '../../components/dialogs/DetailDialog'
import { DifficultySelect } from '../../components/controls/DifficultySelect'
import { DRILL_LENGTHS, type Difficulty, type DrillLength, type ReadingScope } from '../../generated/contracts'
import { CandidateList, RequestedCaption, lengthLabel } from './CandidateList'
import { useDrillPreview } from './useDrillPreview'

const COUNT_MIN = 1
const COUNT_MAX = 20

/** Ask for phrases, look at what came back, keep the ones worth practising.
 *
 * Nothing is added without an explicit choice, and nothing is generated without
 * an explicit request: changing a control never starts work or changes what a
 * request already in flight means. */
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
  const [selected, setSelected] = useState<string[]>([])
  const offer = useDrillPreview(scope, onAdded)

  const quantity = /^\d+$/.test(count.trim()) ? Number(count.trim()) : null
  const askable = quantity !== null && quantity >= COUNT_MIN && quantity <= COUNT_MAX
  const chosen = offer.offered.filter(entry => selected.includes(entry.candidate.candidateId))

  const ask = () => {
    if (!askable) return
    setSelected([])
    void offer.generate({ ...scope, topic: topic.trim() || null, count: quantity, difficulty, length })
  }
  const pick = (which: 'generate' | 'conversation') => {
    if (which === source) return
    setSource(which); setSelected([]); offer.clear()
  }

  return (
    <DetailDialog title={tr("Add phrases")} size="wide" onClose={onClose}>
      <h2>{tr("Add phrases")}</h2>
      <div className="drill-sources" role="radiogroup" aria-label={tr("Where the phrases come from")}>
        <button type="button" role="radio" aria-checked={source === 'generate'} onClick={() => pick('generate')}>{tr("Generate")}</button>
        <button type="button" role="radio" aria-checked={source === 'conversation'} onClick={() => pick('conversation')}>{tr("From your chats")}</button>
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
            : <button type="button" className="btn" disabled={!askable} onClick={ask}>
              {tr(offer.asked ? "Generate again" : "Generate")}
            </button>}
        </div>
        {!askable && count.trim() !== '' && <p role="alert">{tr("Ask for between {value0} and {value1} phrases.", {
          value0: String(COUNT_MIN), value1: String(COUNT_MAX),
        })}</p>}
        <p className="drill-candidates-note">{tr("Length is what to ask for, separately from difficulty. Each request is a new one; nothing is generated until you ask.")}</p>
      </> : <>
        <p className="drill-candidates-note">{tr("Lines you and your partner already wrote, taken exactly as they stand. No new text is written for this.")}</p>
        <div className="drill-ask">
          {offer.running
            ? <p role="status">{tr("Reading your chats…")}</p>
            : <button type="button" className="btn" onClick={() => void offer.loadConversation(null)}>
              {tr(offer.asked ? "Look again" : "Find lines")}
            </button>}
        </div>
      </>}

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
        <RequestedCaption requested={offer.requested} />
        <CandidateList offered={offer.offered} selected={selected} added={offer.added} disabled={offer.adding}
          onToggle={id => setSelected(current => current.includes(id) ? current.filter(entry => entry !== id) : [...current, id])} />
        {offer.hasMore && <button type="button" className="btn" disabled={offer.running} onClick={offer.loadMore}>
          {tr("Show more")}
        </button>}
        <div className="drill-ask">
          <button type="button" className="btn" disabled={offer.adding || chosen.length === 0}
            onClick={() => void offer.accept(chosen).then(() => setSelected([]))}>
            {tr("Add {value0} to practice", { value0: String(chosen.length) })}
          </button>
          <button type="button" className="btn" disabled={offer.adding} onClick={() => { setSelected([]); offer.discard() }}>
            {tr("Discard the rest")}
          </button>
        </div>
      </>}
    </DetailDialog>
  )
}
