import { invoke } from '@tauri-apps/api/core'
import type { RewardEvent } from '../../contracts'

export function claimRewardEvents(target: string, ids: string[]): Promise<RewardEvent[]> {
  return invoke('claim_reward_events', { target, ids })
}
