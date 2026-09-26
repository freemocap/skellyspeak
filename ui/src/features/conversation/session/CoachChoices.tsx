import { CoachIntentTip } from './CoachIntentTip'
import type { ConversationStartConfig, RecommendationMode } from '../../../generated/contracts'
import { InfoTip } from '../../../components/controls/InfoTip'
import { useI18n } from '../../../components/localization/i18n'

/** Choosing a coach mode starts a partner-led conversation; it earns no XP. */
export function CoachChoices({ conversationId, configuration, disabled, selected, onChoose }: { conversationId?: string; configuration?: ConversationStartConfig; disabled: boolean; selected?: RecommendationMode | null; onChoose: (mode: RecommendationMode | null) => void }) {
  const tr = useI18n()
  return <fieldset className="start-choice-row coach-choices" disabled={disabled}>
    <legend>{tr('Practice selection')} {conversationId && configuration ? <CoachIntentTip conversationId={conversationId} configuration={configuration} /> : <InfoTip>{tr('Choose from recorded experience and retry effort, not correctness.')} {tr('Explore uses skills with little recorded experience. Continue practicing uses skills with retry effort. Coach’s choice mixes both.')}</InfoTip>}</legend>
    <div className="coach-choices-grid">
      <span className="coach-choices-label">{tr('Let the coach decide')}</span>
      <button type="button" className="scene-card" aria-pressed={selected === null} onClick={() => onChoose(null)}>{tr('Let the persona decide')}</button>
        <button type="button" className="scene-card" aria-pressed={selected === 'explore'} onClick={() => onChoose('explore')}>{tr('Explore')}</button>
        <button type="button" className="scene-card" aria-pressed={selected === 'continuePracticing'} onClick={() => onChoose('continuePracticing')}>{tr('Continue practicing')}</button>
        <button type="button" className="scene-card" aria-pressed={selected === 'coachChoice'} onClick={() => onChoose('coachChoice')}>{tr('Coach’s choice')}</button>
    </div>
  </fieldset>
}
