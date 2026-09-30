import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import { useI18n } from '../../components/localization/i18n'
import { difficultyLabel } from '../../components/controls/DifficultySelect'
import { TargetMessage } from '../../components/reading/TargetMessage'
import type { DrillGenerationInput } from '../../generated/contracts'
import { lengthLabel } from '../../components/reading/MessageProvenance'
import type { OfferedCandidate } from './useDrillPreview'

/** What was offered, each as the app's standard target-language message with
 * its reading tools, and one press to keep it.
 *
 * Three kinds of claim are kept apart: what was asked for, what the model said
 * about its own output, and what was checked here. Only the last is stated in
 * the row; where a card came from and what the model said about it sit behind
 * the card's information tip. */
export function CandidateList({ offered, added, adding, rtl, onKeep }: {
  offered: OfferedCandidate[]
  added: string[]
  adding: boolean
  rtl: boolean
  onKeep: (entry: OfferedCandidate) => void
}) {
  return (
    <ul className="drill-candidates">
      {offered.map(entry => {
        const isAdded = added.includes(entry.candidate.candidateId)
        return (
          <li key={entry.candidate.candidateId} className="drill-candidate" data-kept={isAdded}>
            <TargetMessage layout="bubble" text={entry.candidate.text} segments={[]} segmentsKey={entry.candidate.candidateId}
              translation={entry.candidate.translation} romanization={null} pronunciation={null} translateLabel={null}
              segmentsPending={false} lookupWords status={null} annotation={null} speech={null} analysis={null}
              focused={false} rtl={rtl}
              provenance={{ source: entry.candidate.source, addedAt: null, reported: entry.candidate.reported }}
              practiceAction={<KeepCandidate entry={entry} isAdded={isAdded} adding={adding} onKeep={onKeep} />} />
          </li>
        )
      })}
    </ul>
  )
}

/** Keeping runs through native acceptance by candidate id, so the card keeps
 * its provenance. It is the same icon-only control, in the same place, as every
 * message's Add to Practice; the list's hint line names the icon once. */
function KeepCandidate({ entry, isAdded, adding, onKeep }: {
  entry: OfferedCandidate; isAdded: boolean; adding: boolean; onKeep: (entry: OfferedCandidate) => void
}) {
  const tr = useI18n()
  if (isAdded) return <span className="drill-chip" data-tone="success">{tr("Added")}</span>
  if (entry.candidate.verified.duplicate) return <span className="drill-chip">{tr("Already in your practice cards")}</span>
  return <button type="button" className="message-translate message-add-drill" data-state="ready" disabled={adding}
    title={tr("Add to Practice")} aria-label={tr("Keep “{value0}”", { value0: entry.candidate.text })}
    onClick={event => { event.stopPropagation(); onKeep(entry) }}>
    <ToolbarIcon name="deck-add" size={20} />
  </button>
}

/** What was asked for, in each request's own words rather than whatever the
 * controls say now — they may have moved on since. One line per paid request,
 * plus a line for lines taken from past chats, which were not asked of anyone. */
export function RequestedCaption({ requested, chats }: { requested: DrillGenerationInput[]; chats: boolean }) {
  const tr = useI18n()
  const said = (one: DrillGenerationInput) => one.topic === null
    ? tr("Asked for {value0} × {value1} at {value2}.", {
        value0: String(one.count), value1: tr(lengthLabel(one.length)).toLocaleLowerCase(tr.browserLocale),
        value2: tr(difficultyLabel(one.difficulty)).toLocaleLowerCase(tr.browserLocale),
      })
    : tr("Asked for {value0} × {value1} at {value2}, on “{value3}”.", {
        value0: String(one.count), value1: tr(lengthLabel(one.length)).toLocaleLowerCase(tr.browserLocale),
        value2: tr(difficultyLabel(one.difficulty)).toLocaleLowerCase(tr.browserLocale), value3: one.topic,
      })
  return (
    <p className="drill-candidates-note">
      {requested.map(one => <span key={one.length}>{said(one)}</span>)}
      {chats && <span>{tr("Taken from your conversations, exactly as written there.")}</span>}
    </p>
  )
}
