import { InfoTip } from '../../../components/controls/InfoTip'
import { useI18n } from '../../../components/localization/i18n'

export function AssessmentInfo() {
  const tr = useI18n()
  return <InfoTip>
    <strong>{tr('Jev Choice')}</strong><br />
    {tr('Jev identifies direct or contextual skill use in your message. The app records experience and credits retained skills on changed retries as effort.')}<br /><br />
    {tr('Correctness and assistance do not change XP. Category probabilities describe the assessment, not your proficiency.')}
  </InfoTip>
}
