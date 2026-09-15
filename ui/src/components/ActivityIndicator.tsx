export function ActivityIndicator({ label, compact = false }: { label: string; compact?: boolean }) {
  return <span className="activity-indicator" role="status"><span className="activity-spinner" aria-hidden="true" /><span className={compact ? 'sr-only' : undefined}>{label}</span></span>
}
