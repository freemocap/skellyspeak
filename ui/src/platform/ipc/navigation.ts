import type { PracticeView } from '../../generated/contracts'
import { invoke } from './native'

export const getPracticeView = (): Promise<PracticeView> => invoke('get_practice_view')
export const savePracticeView = (view: PracticeView): Promise<void> => invoke('set_practice_view', { view })
