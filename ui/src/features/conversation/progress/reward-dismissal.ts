import { useSyncExternalStore } from 'react'

const prefix = 'skellyspeak:reward-dismissed:'
const changed = 'skellyspeak:reward-dismissed'
function subscribe(notify: () => void) {
  window.addEventListener(changed, notify)
  window.addEventListener('storage', notify)
  return () => {
    window.removeEventListener(changed, notify)
    window.removeEventListener('storage', notify)
  }
}
// Evidence IDs contain the durable attempt ID. Store presentation state only;
// credit and automatic celebration claims remain owned by the native ledger.
export function rewardDismissed(id: string, generation: number) {
  return localStorage.getItem(prefix + id) === String(generation)
}
export function dismissReward(id: string, generation: number) {
  localStorage.setItem(prefix + id, String(generation))
  window.dispatchEvent(new Event(changed))
}
export function useRewardDismissed(id: string, generation: number) {
  return useSyncExternalStore(subscribe, () => rewardDismissed(id, generation))
}
