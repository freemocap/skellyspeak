import { invoke } from '@tauri-apps/api/core'
import type { EffortProgress } from '../../generated/contracts'

/** Language totals, or one conversation's when `conversation` is given. */
export const getEffortProgress = (target: string, conversation: string | null = null): Promise<EffortProgress> => invoke('get_effort_progress', { target, conversation })
export const claimEffortAwards = (target: string, ids: string[]): Promise<string[]> => invoke('claim_effort_awards', { target, ids })

export const getEffortReport = (target: string, dimension: import('../../generated/contracts').EffortDimension | null, before: string | null): Promise<import('../../generated/contracts').EffortReport> => invoke('get_effort_report', { target, dimension, before })
