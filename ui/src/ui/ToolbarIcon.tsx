export function ToolbarIcon({ name }: { name: 'reload' | 'settings' | 'profile' }) {
  const paths = {
    reload: <><path d="M20 7v5h-5" /><path d="M19 12a7 7 0 1 0-2 5M20 12l-3-5" /></>,
    settings: <><path d="M4 7h5m4 0h7M4 17h9m4 0h3" /><circle cx="11" cy="7" r="2" /><circle cx="15" cy="17" r="2" /></>,
    profile: <><circle cx="12" cy="8" r="3" /><path d="M5 21v-3a7 7 0 0 1 14 0v3" /></>,
  }
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
