import { useSyncExternalStore } from 'react'

const query = '(prefers-color-scheme: dark)'
const snapshot = () => window.matchMedia(query).matches
const subscribe = (onChange: () => void) => {
  const media = window.matchMedia(query)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

export function useSystemDark() {
  return useSyncExternalStore(subscribe, snapshot, () => false)
}
