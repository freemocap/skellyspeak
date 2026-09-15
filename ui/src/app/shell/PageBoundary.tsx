import { useI18n } from '../../components/localization/i18n'
import { Component, type ReactNode } from 'react'

// Keeps a render crash from blanking the whole app.
export class PageBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return <CrashedView error={this.state.error} reload={() => this.setState({ error: null })} />
    }
    return this.props.children
  }
}

function CrashedView({ error, reload }: { error: Error; reload: () => void }) {
  const tr = useI18n()
  return <div className="not-tauri"><p>{tr('This view crashed: {message}', { message: error.message })}</p><button type="button" className="btn" onClick={reload}>{tr('Reload view')}</button></div>
}
