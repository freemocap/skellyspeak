import { useState, type ReactNode } from 'react'
export function Disclosure({ label, className, children }: { label: ReactNode; className: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return <details className={className} onToggle={event => setOpen(event.currentTarget.open)}><summary>{label}</summary>{open && children}</details>
}
