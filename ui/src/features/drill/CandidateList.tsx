import { useI18n } from '../../components/localization/i18n'
import { messageKey } from '../../domain/localization'
import { difficultyLabel } from '../../components/controls/DifficultySelect'
import type { DrillGenerationInput, DrillLength } from '../../generated/contracts'
import type { OfferedCandidate } from './useDrillPreview'

/// Functional names for the requested shape. The values come from the generated
/// contract; only their display names live here.
const LENGTHS = {
  word: messageKey('Word'),
  shortPhrase: messageKey('Short phrase'),
  sentence: messageKey('Sentence'),
  severalSentences: messageKey('Several sentences'),
} as const satisfies Record<DrillLength, string>

export function lengthLabel(value: DrillLength): string {
  return LENGTHS[value]
}

/** What was offered, and one press to keep each of it.
 *
 * Three kinds of claim are kept apart: what was asked for, what the model said
 * about its own output, and what was checked here. Only the last is stated as
 * fact; a model calling its own line "beginner" is reported, not verified. */
export function CandidateList({ offered, added, adding, onKeep }: {
  offered: OfferedCandidate[]
  added: string[]
  adding: boolean
  onKeep: (entry: OfferedCandidate) => void
}) {
  const tr = useI18n()
  return (
    <ul className="drill-candidates">
      {offered.map(entry => {
        const { candidate } = entry
        const isAdded = added.includes(candidate.candidateId)
        return (
          <li key={candidate.candidateId} className="drill-candidate" data-kept={isAdded}>
            <span className="drill-candidate-body">
              <bdi className="drill-candidate-text">{candidate.text}</bdi>
              {candidate.translation !== null && <span className="drill-candidate-translation">{candidate.translation}</span>}
              <span className="drill-candidate-notes">
                {candidate.source.kind === 'conversation'
                  && <span className="drill-chip">{tr("From your chats")}</span>}
                {candidate.reported.difficulty !== null
                  && <span className="drill-chip">{tr("Model says {value0}", { value0: candidate.reported.difficulty })}</span>}
                {candidate.reported.tags.map(tag => <span key={tag} className="drill-chip">{tr("Model says {value0}", { value0: tag })}</span>)}
              </span>
            </span>
            {isAdded
              ? <span className="drill-chip" data-tone="success">{tr("Added")}</span>
              : candidate.verified.duplicate
                ? <span className="drill-chip">{tr("Already in your phrases")}</span>
                : <button type="button" className="btn" disabled={adding} onClick={() => onKeep(entry)}
                  aria-label={tr("Keep “{value0}”", { value0: candidate.text })}>{tr("Keep")}</button>}
          </li>
        )
      })}
    </ul>
  )
}

/** What was asked for, in the request's own words rather than whatever the
 * controls say now — they may have moved on since. */
export function RequestedCaption({ requested }: { requested: DrillGenerationInput | null }) {
  const tr = useI18n()
  if (requested === null) return <p className="drill-candidates-note">{tr("Taken from your chats, exactly as written there.")}</p>
  return <p className="drill-candidates-note">{requested.topic === null
    ? tr("Asked for {value0} × {value1} at {value2}.", {
        value0: String(requested.count), value1: tr(lengthLabel(requested.length)).toLocaleLowerCase(tr.browserLocale),
        value2: tr(difficultyLabel(requested.difficulty)).toLocaleLowerCase(tr.browserLocale),
      })
    : tr("Asked for {value0} × {value1} at {value2}, on “{value3}”.", {
        value0: String(requested.count), value1: tr(lengthLabel(requested.length)).toLocaleLowerCase(tr.browserLocale),
        value2: tr(difficultyLabel(requested.difficulty)).toLocaleLowerCase(tr.browserLocale), value3: requested.topic,
      })}</p>
}
