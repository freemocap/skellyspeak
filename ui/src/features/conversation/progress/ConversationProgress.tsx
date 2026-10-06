import { useContext, useState } from 'react'
import { useI18n } from '../../../components/localization/i18n'
import { EvidenceMappingNotice } from '../../../components/learning/EvidenceMappingNotice'
import { conversationUnits } from '../../../components/learning/effort-dimensions'
import { conversationEvidence } from '../../../domain/learning/evidence/skills'
import { useVisibleEffort } from '../../../state/learning/EffortProgressContext'
import { useConversationEffort } from '../../../state/learning/useEffortProgress'
import { SkillEvidenceContext } from '../../../state/learning/useSkillEvidence'
import { useNavigationStore } from '../../../state/navigation/navigation'
import { EffortCounts } from './EffortCounts'
import { InfoTip } from '../../../components/controls/InfoTip'
import { ConversationMap } from './ConversationMap'
import type { ConversationProgressSection } from './XpChip'
import { XpEvidenceReport, type XpMessageScope } from './XpEvidenceReport'
import { XpLedger } from './XpLedger'

/** The element id of a section, for the header counters to scroll to. */
export function conversationProgressSectionId(section: ConversationProgressSection): string {
  return `conversation-progress-${section}`
}

/** The learning panel's Progress tab: this conversation's share of the three
 * things the Progress page shows, in the page's order. Skills (the language's
 * levels with this conversation's points over them), XP (this conversation's
 * credited skill uses), then Effort (what was done here).
 * The last button opens the Progress page for the whole language. */
export function ConversationProgress({ chatId, languageName }: { chatId: string; languageName: string }) {
  const tr = useI18n()
  const evidence = useContext(SkillEvidenceContext)
  const shell = useVisibleEffort()
  const effort = useConversationEffort(evidence.snapshot?.target ?? '', chatId, shell.value)
  const openProgress = useNavigationStore(state => state.openProgress)
  const [message, setMessage] = useState<XpMessageScope | null>(null)
  if (!evidence.snapshot) return null
  const language = evidence.snapshot
  return <>
    <div className="analysis-scroll conversation-evidence" role="region" aria-label={tr("Progress")} tabIndex={0}>
      <section className="conversation-progress-section" id={conversationProgressSectionId('skills')} aria-labelledby="conversation-progress-skills-title">
        <h3 className="conversation-progress-title" id="conversation-progress-skills-title">{tr('Skills')}</h3>
        <EvidenceMappingNotice snapshot={conversationEvidence(language, chatId)} />
        <ConversationMap languageSnapshot={language} languageName={languageName} chatId={chatId} />
      </section>
      <section className="conversation-progress-section" id={conversationProgressSectionId('xp')} aria-labelledby="conversation-progress-xp-title">
        <h3 className="conversation-progress-title" id="conversation-progress-xp-title">{tr('XP')}</h3>
        <XpLedger snapshot={language} chatId={chatId} onInspectMessage={setMessage} />
      </section>
      <section className="conversation-progress-section" aria-labelledby="conversation-progress-effort-title">
        <h3 className="conversation-progress-title" id="conversation-progress-effort-title">{tr('Effort')}<InfoTip>{tr('What you did in this conversation, one count each.')}</InfoTip></h3>
        <EffortCounts effort={effort.value} units={conversationUnits} error={effort.error} />
      </section>
      <button type="button" className="btn conversation-progress-open" onClick={() => openProgress('skills')}>{tr('Open the Progress page')}</button>
    </div>
    {message && <XpEvidenceReport snapshot={language} message={message} onClose={() => setMessage(null)} />}
  </>
}
