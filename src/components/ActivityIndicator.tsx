export function ActivityIndicator({ label }: { label: string }) {
  return <span className="activity-indicator" role="status"><span className="activity-spinner" aria-hidden="true" />{label}</span>
}
