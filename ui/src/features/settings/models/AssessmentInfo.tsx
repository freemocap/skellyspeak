import { InfoTip } from '../../../components/controls/InfoTip'
import { useI18n } from '../../../components/localization/i18n'

export function AssessmentInfo() {
  const tr = useI18n()
  return <InfoTip>
    <strong>{tr('Jev Choice')} — {tr('Disabled')}</strong><br />
    {tr('Jev evaluates skill questions and returns category probabilities. The selected Fast model then locates supporting quotes in your message. The app validates those quotes before publishing XP.')}<br /><br />
    <strong>{tr('Chat model assessment')}</strong><br />
    {tr('Uses the selected Fast model to generate structured observations, including exact learner quotes and explanations. The app validates those quotes before accepting evidence.')}<br /><br />
    {tr('Both can make incorrect judgments. Probabilities describe assessment outcomes, not learner proficiency. Switching affects future assessments; saved evidence keeps its original source and method.')}
  </InfoTip>
}
