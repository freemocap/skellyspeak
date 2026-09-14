import { useI18n } from './i18n'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { DetailDialog } from './DetailDialog'
import { nativeError } from '../platform/ipc/workspace'

/** Native-generated YAML only. A preview never downloads or invokes AI. */
export function YamlExport({ title, scope, view, save, children, onClose }: {
  title: string; scope: string; view: () => Promise<string>; save: () => Promise<string>
  children?: ReactNode; onClose: () => void
}) {
  const tr = useI18n()
  const [yaml, setYaml] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'view' | 'save' | null>(null)
  const generation = useRef(0)
  const owner = useRef(scope)
  owner.current = scope
  useEffect(() => {
    generation.current++
    setYaml(null); setSaved(null); setError(null); setBusy(null)
    return () => { generation.current++ }
  }, [scope])
  async function run(kind: 'view' | 'save') {
    if (busy) return
    const request = ++generation.current
    const source = scope
    setBusy(kind); setError(null); setSaved(null)
    try {
      const result = await (kind === 'view' ? view() : save())
      if (request !== generation.current || source !== owner.current) return
      if (kind === 'view') setYaml(result)
      else setSaved(result)
    } catch (reason) {
      if (request === generation.current && source === owner.current) setError(nativeError(reason))
    } finally {
      if (request === generation.current && source === owner.current) setBusy(null)
    }
  }
  return <DetailDialog title={title} onClose={onClose}>
    <h2>{title}</h2>
    <div className="yaml-export">
      {children}
      <button disabled={busy !== null} onClick={() => void run('view')}>{busy === 'view' ? tr("Loading YAML…") : tr("View YAML")}</button>
      <button disabled={busy !== null} onClick={() => void run('save')}>{busy === 'save' ? tr("Saving YAML…") : tr("Save YAML")}</button>
    </div>
    <p>{tr("Each action reads the latest saved data. Files are saved to Downloads.")}</p>
    {saved && <p role="status">{tr("Saved to ")}{saved}</p>}
    {error && <p role="alert">{error}</p>}
    {yaml !== null && <pre className="yaml-viewer" dir="ltr" tabIndex={0} aria-label={tr("{value0} content", { value0: String(title) })}>{yaml}</pre>}
  </DetailDialog>
}
