export function ActivityIndicator({ label, compact = false, announce = true }: { label: string; compact?: boolean; announce?: boolean }) {
  return <span className="activity-indicator" role={announce ? 'status' : undefined}><span className="activity-spinner" aria-hidden="true" /><span className={compact ? 'sr-only' : undefined}>{label}</span></span>
}
