import { useCallback, useState } from 'react'

/** One of a fixed set of values, kept per browser profile. `null` until the
 * learner chooses. A stored value outside the set is refused. */
export function useStoredChoice<T extends string>(key: string, options: readonly T[]): [T | null, (value: T) => void] {
  const [value, setValue] = useState<T | null>(() => {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    if (!(options as readonly string[]).includes(raw)) throw new Error(`Stored choice ${key} is not one of ${options.join(', ')}: ${raw}`)
    return raw as T
  })
  const choose = useCallback((next: T) => {
    setValue(next)
    localStorage.setItem(key, next)
  }, [key])
  return [value, choose]
}
