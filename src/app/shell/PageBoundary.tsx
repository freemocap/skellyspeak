import { Component, type ReactNode } from 'react'

// Keeps a render crash from blanking the whole app.
export class PageBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div className="not-tauri">
          This view crashed: {this.state.error.message}
          <br />
          <br />
          <button
            type="button"
            className="btn"
            onClick={() => this.setState({ error: null })}
          >
            Reload view
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
