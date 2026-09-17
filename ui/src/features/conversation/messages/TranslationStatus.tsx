import { ActivityIndicator } from '../../../components/feedback/ActivityIndicator'
import { useI18n } from '../../../components/localization/i18n'

export function TranslationStatus({ state }: { state?: string | null }) {
  const tr = useI18n()
  return <>
    {['ready', 'running', 'waiting_dependencies'].includes(state ?? '') &&
      <ActivityIndicator label={tr("Translating…")} />}
    {state === 'failed' && <div className="trans" role="status">{tr("Translation failed")}</div>}
    {state === 'unknown' && <div className="trans" role="status">{tr("Translation outcome unknown")}</div>}
    {state === 'cancelled' && <div className="trans" role="status">{tr("Translation cancelled")}</div>}
    {state === 'invalidated' && <div className="trans" role="status">{tr("Translation unavailable")}</div>}
  </>
}
