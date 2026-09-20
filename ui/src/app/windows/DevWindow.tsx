import { ReadingTools } from '../ReadingTools'
import { useEffect, useState } from 'react'
import type { Settings } from '../../types'
import { I18nProvider, useI18n } from '../../components/localization/i18n'
import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import { AiView } from '../../features/activity/AiView'
import { reportFault } from '../../platform/diagnostics/faults'
import { getSettings } from '../../platform/ipc/tauri'
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
  const [settings, setSettings] = useState<Settings | null>(null)
  useEffect(() => { getSettings().then(setSettings).catch(error => reportFault('Reading settings for the AI window', error)) }, [])
  useAppearance(settings)
  return <I18nProvider locale={settings?.interface_locale ?? 'english'}><ReadingTools settings={settings} onAsk={question => { void sendReadingQuestion(question).catch(error => reportFault('Opening the coach', error)) }}><PoppedOutView /></ReadingTools></I18nProvider>
}
