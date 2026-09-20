import { Fragment, type ReactNode } from 'react'
import { inspectionParts, paragraphize } from './inspectionText'
import { Markdown } from '../../components/reading/Markdown'
import { useI18n } from '../../components/localization/i18n'

export type InspectionMode = 'readable' | 'source'

export function InspectionModeControl({ mode, onChange }: { mode: InspectionMode; onChange: (mode: InspectionMode) => void }) {
  const tr = useI18n()
  return <div className="ai-content-mode" role="group" aria-label={tr('Content view')}>
    <button type="button" className="ai-chip" aria-pressed={mode === 'readable'} onClick={() => onChange('readable')}>{tr('Readable')}</button>
    <button type="button" className="ai-chip" aria-pressed={mode === 'source'} onClick={() => onChange('source')}>{tr('Source')}</button>
  </div>
}

function json(text: string): { value: unknown } | null {
  if (!/^[\s]*[\[{\"]/.test(text)) return null
  try { return { value: JSON.parse(text) as unknown } } catch { return null }
}

// Preserve all keys and values; this is a presentation, not a summary or redactor.
function readable(value: unknown, depth = 0): ReactNode {
  if (depth >= 16) return <pre>{typeof value === 'string' ? value : JSON.stringify(value, null, 2)}</pre>
  if (typeof value === 'string') {
    const parsed = json(value)
    if (parsed) return readable(parsed.value, depth + 1)
    return inspectionParts(value).map((part, index) => <Fragment key={index}>
      {'text' in part ? <Markdown text={paragraphize(part.text)} /> : readable(part.value, depth + 1)}
    </Fragment>)
  }
  if (Array.isArray(value)) return value.length ? <ol>{value.map((item, index) => <li key={index}>{readable(item, depth + 1)}</li>)}</ol> : <code>[]</code>
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
    return entries.length ? <dl className="ai-readable-fields">{entries.map(([key, item]) => <Fragment key={key}>
      <dt>{key}</dt><dd>{readable(item, depth + 1)}</dd>
    </Fragment>)}</dl> : <code>{'{}'}</code>
  }
  return <code>{JSON.stringify(value)}</code>
}

export function InspectionContent({ text, mode }: { text: string; mode: InspectionMode }) {
  return mode === 'source' ? <pre className="ai-content-source" dir="auto">{text}</pre>
    : <div className="ai-content-readable" dir="auto">{readable(text)}</div>
}
