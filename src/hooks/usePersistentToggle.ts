import { useCallback, useState } from 'react'

export function usePersistentToggle(key: string, defaultOpen: boolean) {
  const [open, setOpen] = useState<boolean>(() => {
    const v = localStorage.getItem(key)
    return v === null ? defaultOpen : v !== 'closed'
  })
  const toggle = useCallback(() => {
    setOpen((o) => {
      localStorage.setItem(key, o ? 'closed' : 'open')
      return !o
    })
  }, [key])
  return { open, toggle }
}

