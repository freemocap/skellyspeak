import { InfoTip } from '../../components/controls/InfoTip'
import { useI18n } from '../../components/localization/i18n'
import { messageKey } from '../../domain/localization'
import { difficultyLabel } from '../../components/controls/DifficultySelect'
import { TargetPhrase } from '../../components/reading/TargetPhrase'
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
              {candidate.source.kind === 'generated' && candidate.source.skillFocus && <span className="drill-chip">{tr('Skill focus')}: {tr(candidate.source.skillFocus.skill.name)}{candidate.source.skillFocus.recommendation && <InfoTip>{tr('Experience')}: {tr.number(candidate.source.skillFocus.recommendation.skill.experience)}{' · '}{tr('Effort')}: {tr.number(candidate.source.skillFocus.recommendation.skill.effort)}</InfoTip>}</span>}
              <TargetPhrase text={candidate.text} addToDrill={false} />
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
      {chats && <span>{tr("Taken from your chats, exactly as written there.")}</span>}
    </p>
  )
}
