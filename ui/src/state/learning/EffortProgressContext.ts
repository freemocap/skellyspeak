import { createContext, useContext } from 'react'
import type { EffortProgress } from '../../generated/contracts'

/** One shell-owned read and claim feeds every visible counter. */
export const EffortProgressContext = createContext<{
  target: string; value: EffortProgress | null; error: string | null; arrived: string[]; effects: boolean
}>({ target: '', value: null, error: null, arrived: [], effects: true })
export const useVisibleEffort = () => useContext(EffortProgressContext)
