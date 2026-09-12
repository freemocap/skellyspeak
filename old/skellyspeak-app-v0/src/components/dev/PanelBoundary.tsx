import { Component, type ReactNode, type ErrorInfo } from 'react'
import { reportFault } from '../../lib/faults'

export class PanelBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state: { error: string | null } = { error: null }
  static getDerivedStateFromError(error: unknown): { error: string } { return { error: String(error) } }
  componentDidCatch(error: Error, _info: ErrorInfo): void { reportFault('AI panel', error) }
  render() {
    return this.state.error
      ? <div role="alert" className="activity-error"><strong>This AI view could not load.</strong><p>{this.state.error}</p><p>Your conversation is still available. Choose another AI view; if the development server stopped, restart it and reload the app.</p></div>
      : this.props.children
  }
}
