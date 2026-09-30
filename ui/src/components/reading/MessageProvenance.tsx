import { InfoTip } from '../controls/InfoTip'
import { ToolbarIcon } from '../controls/ToolbarIcon'
import { difficultyLabel } from '../controls/DifficultySelect'
import { useI18n } from '../localization/i18n'
import { messageKey } from '../../domain/localization'
import type { DrillLength, DrillReportedLabels, DrillSource } from '../../generated/contracts'

/// Display names for the requested shape of a phrase. The values come from the
/// generated contract; only their display names live here.
const LENGTHS = {
  word: messageKey('Word'),
  shortPhrase: messageKey('Short phrase'),
  sentence: messageKey('Sentence'),
  severalSentences: messageKey('Several sentences'),
} as const satisfies Record<DrillLength, string>

export function lengthLabel(value: DrillLength): string {
  return LENGTHS[value]
}

/** Where a message's text came from. A message shows it only when its owner
 * supplies one; `reported` is what a model said about its own output, kept
 * apart from what the source records. */
export interface MessageProvenance {
  source: DrillSource
  addedAt: string | null
  reported: DrillReportedLabels | null
}

/** The message's "How this was added" tip: generated (and for which skill),
 * taken from a conversation, or added by the learner. */
export function ProvenanceTip({ provenance }: { provenance: MessageProvenance }) {
  const tr = useI18n()
  const { source, addedAt, reported } = provenance
  const added = addedAt === null ? null : tr("Added {value0}", { value0: tr.date(new Date(addedAt), { dateStyle: 'medium' }) })
  const modelLabels = reported === null ? [] : [...(reported.difficulty === null ? [] : [reported.difficulty]), ...reported.tags]
  return <span className="message-provenance">
    <InfoTip>
      <span className="message-provenance-card">
        <span className="message-provenance-heading">{tr("How this was added")}</span>
        {source.kind === 'own' && <span className="message-provenance-kind"><ToolbarIcon name="deck-added" size={16} />{tr("Added by you")}</span>}
        {source.kind === 'generated' && <>
          <span className="message-provenance-kind"><ToolbarIcon name="star" size={16} />
            {source.skillFocus ? tr("Generated for a skill") : tr("Generated")}</span>
          {source.skillFocus && <span className="message-provenance-line">{tr(source.skillFocus.skill.name)}</span>}
          <span className="message-provenance-line">{tr(lengthLabel(source.length))} · {tr(difficultyLabel(source.difficulty))}</span>
          {source.topic !== null && <span className="message-provenance-line">{tr("Topic: {value0}", { value0: source.topic })}</span>}
        </>}
        {source.kind === 'conversation' && <>
          <span className="message-provenance-kind"><ToolbarIcon name="chat" size={16} />{tr("From a conversation")}</span>
          <span className="message-provenance-line">{speakerLine(source.sourceRef.role, tr)}</span>
        </>}
        {added && <span className="message-provenance-meta">{added}</span>}
        {modelLabels.length > 0 && <span className="message-provenance-model">
          {tr("Model’s own labels: {value0}", { value0: modelLabels.join(', ') })}</span>}
      </span>
    </InfoTip>
  </span>
}

function speakerLine(role: string, tr: ReturnType<typeof useI18n>): string {
  if (role === 'user') return tr("You said this")
  if (role === 'assistant') return tr("Your partner said this")
  throw new Error(`Unknown conversation role for a practice card: ${role}`)
}
