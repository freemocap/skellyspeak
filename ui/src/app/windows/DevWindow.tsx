import { ActionRewardBursts } from '../../components/learning/ActionRewardBursts'
import { ReadingTools } from '../ReadingTools'
import { useEffect } from 'react'
import { useSettingsStore } from '../../state/settings/settings'
import { I18nProvider, useI18n } from '../../components/localization/i18n'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import { AiView } from '../../features/activity/AiView'
import { reportFault } from '../../platform/diagnostics/faults'
import { useAppearance } from '../../platform/appearance/useAppearance'
import { dockAiWindow, sendReadingQuestion } from '../../platform/ipc/window'

function PoppedOutView() {
  const tr = useI18n()
  const popIn = <button type="button" className="ai-pop-in" onClick={() => { dockAiWindow().catch(error => reportFault('Returning the AI View to the main window', error)) }}>
    <ToolbarIcon name="popin" size={15} />{tr('Pop in')}
  </button>
  return <div className="dev-window"><AiView mode="window" actions={popIn} /></div>
}

/// The popped-out AI View, in the learner's interface language and theme.
/// Pop in hands the view back to the main window's panel; the selection
/// travels through native.
export default function DevWindow() {
  const settings = useSettingsStore(state => state.settings)
  useEffect(() => {
    const refresh = () => { void useSettingsStore.getState().load().catch(error => reportFault('Reading settings for the AI window', error)) }
    refresh()
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])
  useAppearance(settings)
  return <I18nProvider locale={settings?.interface_locale ?? 'english'}><ReadingTools settings={settings} onAsk={question => { void sendReadingQuestion(question).catch(error => reportFault('Opening the coach', error)) }}><ActionRewardBursts enabled={settings?.xp_effects !== false} /><PoppedOutView /></ReadingTools></I18nProvider>
}
