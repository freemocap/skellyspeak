import { ToolbarIcon } from '../../components/controls/ToolbarIcon'
import { useI18n } from '../../components/localization/i18n'
import { useNavigationStore } from '../../state/navigation/navigation'

/** The way back from a destination (Practice, Skills) to the conversation it
 * was opened from. The conversation stays mounted underneath, so returning
 * restores its draft, scroll position and coach panel. */
export function ReturnStrip() {
  const tr = useI18n()
  const openConversation = useNavigationStore(state => state.openConversation)
  return <div className="return-strip">
    <button type="button" className="btn return-to-conversation" onClick={() => openConversation()}>
      <ToolbarIcon name="back" /><span>{tr('Back to conversation')}</span>
    </button>
  </div>
}
