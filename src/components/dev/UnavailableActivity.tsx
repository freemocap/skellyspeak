/** Preserve the AI panel frame without mounting unsupported trace/graph controllers. */
export function UnavailableActivity() {
  return <p className="logs-line" role="status">AI activity graph is not connected.</p>
}
