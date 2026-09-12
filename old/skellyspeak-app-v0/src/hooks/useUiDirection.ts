import { useEffect, useState } from 'react'

/** App applies the native-language registry direction to the document. */
export function useUiDirection(): 'ltr' | 'rtl' {
  const readDirection = (): 'ltr' | 'rtl' => document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr'
  const [direction, setDirection] = useState(readDirection)
  useEffect(() => {
    const update = () => setDirection(readDirection())
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['dir'] })
    update()
    return () => observer.disconnect()
  }, [])
  return direction
}
