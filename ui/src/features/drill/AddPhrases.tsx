import { DrillSkillSelection } from './DrillSkillSelection'
import { ErrorNotice } from '../../components/feedback/ErrorNotice'
import { useState } from 'react'
import { useI18n } from '../../components/localization/i18n'
import { errorMessage } from '../../platform/diagnostics/error-details'
import { languageFor } from '../../platform/ipc/tauri'
import { DetailDialog } from '../../components/dialogs/DetailDialog'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import { DifficultySelect } from '../../components/controls/DifficultySelect'
import { ReadingScopeContext } from '../../components/reading/ReadingContext'
import { ReadingLanguageScope } from '../../components/reading/ReadingLanguageScope'
import { DRILL_LENGTHS, type Difficulty, type DrillGenerationInput, type DrillGenerationPreview, type DrillSkillTarget, type DrillLength, type ReadingScope } from '../../generated/contracts'
import { CandidateList, RequestedCaption } from './CandidateList'
import { AddToPracticeHint } from './AddToPracticeHint'
import { messageKey } from '../../domain/localization'
import { lengthLabel } from '../../components/reading/MessageProvenance'
import { useDrillPreview } from './useDrillPreview'
import { PracticeSets } from './PracticeSets'
import { ActivityIndicator } from '../../components/feedback/ActivityIndicator'

const COUNT_MIN = 1
const COUNT_MAX = 20
/// How many phrases the dialog asks for until the learner changes it.
const DEFAULT_COUNT = 8
/// Placeholder bubbles drawn in the empty results well.
const PLACEHOLDER_BUBBLES = 4

/** Ask for phrases, and keep the ones worth practising.
 *
 * One list of what to add: the lengths, and the learner's own past chats as a
 * source beside them. One press asks, one press per phrase keeps it. Nothing is
 * requested or added without an explicit press. */
export function AddPhrases({ scope, initialPreview, onAdded, onClose }: {
  scope: ReadingScope
  initialPreview?: DrillGenerationPreview | null
  onAdded: () => Promise<void>
  onClose: () => void
}) {
  const tr = useI18n()
  const [lengths, setLengths] = useState<DrillLength[]>(['shortPhrase'])
  const [chats, setChats] = useState(false)
  const [skillTarget, setSkillTarget] = useState<DrillSkillTarget | null>(null)
  const [topic, setTopic] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner')
  const [count, setCount] = useState(String(DEFAULT_COUNT))
  const [bundledAdding, setBundledAdding] = useState(false)
  const [translations, setTranslations] = useState<boolean | null>(null)
  const [phonetics, setPhonetics] = useState<boolean | null>(null)
  const [pregeneratedOpen, setPregeneratedOpen] = useState(false)
  const offer = useDrillPreview(scope, onAdded, initialPreview)
  const language = languageFor(scope.language, scope.variety ?? undefined)
  if (!language) throw new Error(`No language configuration for ${scope.language} (${scope.variety ?? 'no variety'}).`)

  const quantity = /^\d+$/.test(count.trim()) ? Number(count.trim()) : null
  const counted = quantity !== null && quantity >= COUNT_MIN && quantity <= COUNT_MAX
  const askable = (lengths.length > 0 && counted && (skillTarget?.kind !== 'skill' || !!skillTarget.skillId)) || (lengths.length === 0 && chats)
  const keepable = offer.offered.filter(entry =>
    !offer.added.includes(entry.candidate.candidateId) && !entry.candidate.verified.duplicate)

  const ask = () => {
    if (!askable) return
    // One request per length: the contract carries a single length, so a mixed
    // ask is several requests sharing out the quantity between them.
    const inputs: DrillGenerationInput[] = lengths.map((length, index) => ({
      ...scope,
      ...(skillTarget ? { skillTarget } : {}),
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
    <DetailDialog title={tr("Add practice cards")} size="wide" onClose={leave}>
      <ReadingScopeContext value={scope}><ReadingLanguageScope language={scope.language} variety={scope.variety}>
        <h2>{tr("Add practice cards")}</h2>
        <details className="drill-pregenerated" onToggle={event => setPregeneratedOpen(event.currentTarget.open)}>
          <summary className={`btn${pregeneratedOpen ? '' : ' outline'}`}><ToolbarIcon name="chevron" />{tr('Show pre-generated phrases')}</summary>
          <PracticeSets key={JSON.stringify(scope)} scope={scope} layout="buttons" disabled={offer.running || offer.adding}
            onBusyChange={setBundledAdding} onPreview={offer.offerPreview} />
        </details>
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
                  {tr("Lines from your conversations")}
                </label>
              </div>
            </fieldset>

            <DrillSkillSelection scope={scope} value={skillTarget} disabled={offer.running || lengths.length === 0} onChange={setSkillTarget} />
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
              : <button type="button" className="btn outline" disabled={!askable || bundledAdding} onClick={ask}>
                {tr(offer.asked ? "Generate again" : "Generate")}
              </button>}
            {lengths.length > 0 && !counted && count.trim() !== ''
              && <p role="alert">{tr("Choose between {value0} and {value1} practice cards to generate.", {
                value0: String(COUNT_MIN), value1: String(COUNT_MAX),
              })}</p>}
            {lengths.length === 0 && !chats && <p role="alert">{tr("Pick at least one thing to add.")}</p>}
          </div>

          <div className="drill-add-results">
            {offer.running && <p className="activity-line"><ActivityIndicator label={tr("Generating practice cards…")} /></p>}
            {offer.failure != null && <ErrorNotice as="p" onRetry={offer.retry} error={offer.failure}>{errorMessage(offer.failure)}</ErrorNotice>}
            {offer.shortfall !== null && <p role="status">{tr("Generated {value1} of {value0} practice cards: {value2}", {
              value0: String(offer.shortfall.requested), value1: String(offer.shortfall.produced), value2: offer.shortfall.reason,
            })}</p>}

            {offer.offered.length > 0 && <>
              <RequestedCaption requested={offer.requested} />
              <div className="drill-add-actions">
                <AddToPracticeHint message={messageKey("Click {value0} to add a phrase to your practice cards.")} />
                <span className="drill-inspection-spacer" />
                {keepable.length > 1 && <button type="button" className="btn" disabled={offer.adding || bundledAdding}
                  onClick={() => void offer.accept(keepable)}>
                  {tr("Keep all {value0}", { value0: String(keepable.length) })}
                </button>}
                <button type="button" className="btn" disabled={offer.adding || bundledAdding}
                  onClick={offer.discard}>{tr('Clear all')}</button>
              </div>
              <div className="drill-add-actions">
                <label className="check-label"><input type="checkbox" checked={translations === true}
                  onChange={event => setTranslations(event.target.checked)} />{tr('Show all translations')}</label>
                <label className="check-label"><input type="checkbox" checked={phonetics === true}
                  onChange={event => setPhonetics(event.target.checked)} />{tr('Show all pronunciations / romanizations')}</label>
              </div>
            </>}

            {/* A recessed well that exists before anything is asked, so cards land
                in a place that is already there. */}
            <div className="drill-add-well" aria-busy={offer.running}>
              {offer.offered.length > 0
                ? <>
                  <CandidateList offered={offer.offered} added={offer.added} adding={offer.adding || bundledAdding}
                    bulkReading={{ translations, phonetics }} rtl={language.direction === 'rtl'} onKeep={entry => void offer.accept([entry])} />
                  {offer.hasMore && <button type="button" className="btn drill-more" disabled={offer.running}
                    onClick={offer.loadMore}>{tr("Show more")}</button>}
                </>
                : <div className="drill-add-placeholder">
                  {Array.from({ length: PLACEHOLDER_BUBBLES }, (_, index) => <span key={index} className="drill-add-ghost" aria-hidden="true" />)}
                  {!offer.running && <p className="drill-add-placeholder-note">{offer.asked
                    ? tr("No practice cards were generated. Generate again or change the options.")
                    : tr("Generated phrases will appear here.")}</p>}
                </div>}
            </div>
          </div>

        </div>
      </ReadingLanguageScope></ReadingScopeContext>
    </DetailDialog>
  )
}
