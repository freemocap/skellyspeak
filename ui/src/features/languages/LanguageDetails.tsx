import { useState } from 'react'
import { useI18n } from '../../components/localization/i18n'
import type { LanguageInspection } from '../../generated/contracts'

export function LanguageDetails({ report }: { report: LanguageInspection }) {
  const tr = useI18n()
  const [documentKey, setDocumentKey] = useState('resolved')
  const documents = [
    { key: 'resolved', label: tr('Resolved model'), text: report.resolvedJson },
    { key: 'schema', label: tr('Validation schema'), text: report.schemaJson },
    { key: 'learning', label: tr('Language learning material'), text: report.learningJson },
    { key: 'conversation', label: tr('Conversation definition'), text: report.conversationJson },
    ...report.sources.map(source => ({ key: source.path, label: source.path, text: source.yaml })),
  ]
  const document = documents.find(item => item.key === documentKey) ?? documents[0]
  const labels: Record<string, string> = { script: tr('Script'), direction: tr('Text direction'), font_scale: tr('Script size'), word_spacing: tr('Spaces between words'), romanization: tr('Romanization') }
  function display(field: string, value: string): string {
    if (field === 'romanization') return report.schemes.find(scheme => scheme.id === value)?.label ?? tr('Disabled')
    if (field === 'direction') return value === 'rtl' ? tr('Right to left') : tr('Left to right')
    if (field === 'word_spacing') return value === 'true' ? tr('Yes') : tr('No')
    if (field === 'font_scale') return `${value}×`
    return value.replaceAll('-', ' ')
  }
  return <div className="language-content">
    <p className="language-status"><span data-review={report.review}>{report.review === 'needs_review' ? tr('Linguistic review pending') : tr('Linguistically reviewed')}</span><span>{report.family}</span></p>
    <section><h3>{tr('Writing and reading')}</h3>
      <dl>{report.values.map(value => <div key={value.field}><dt>{labels[value.field]}</dt><dd>{display(value.field, value.value)}</dd></div>)}</dl>
      {report.schemes.length === 0 && <p>{tr('No romanization scheme configured')}</p>}
      {report.schemes.map(scheme => <article key={scheme.id}>
        <h4>{scheme.label}{scheme.selected && ` · ${tr('Default')}`}</h4>
        <table><thead><tr><th>{tr('Original')}</th><th>{tr('Romanization')}</th></tr></thead><tbody>{scheme.examples.map(([original, romanized], index) => <tr key={index}><td lang={report.language.languageTag ?? undefined} dir={report.language.direction}>{original}</td><td>{romanized}</td></tr>)}</tbody></table>
        <h5>{tr('Romanization instructions')}</h5><p>{scheme.instructions}</p><p>{tr('Sources')}: {scheme.sources.join(', ')} · {scheme.review === 'needs_review' ? tr('Linguistic review pending') : tr('Linguistically reviewed')}</p>
      </article>)}
    </section>
    {report.rules.length > 0 && <section><h3>{tr('Language-specific guidance')}</h3>{report.rules.map((rule,index) => <p key={index}>{rule.text}</p>)}</section>}
    <section><h3>{tr('Default conversation partner')}</h3><h4>{report.partner.name}</h4><p>{report.partner.location} · {report.partner.occupation}</p><p>{report.partner.background}</p><p>{report.partner.currentSituation}</p></section>
    <section className="language-definition"><h3>{tr('Full definition')}</h3>
      <h4>{tr('Resolved settings and sources')}</h4>
      <dl>{report.values.map(value => <div key={value.field}><dt>{value.field}</dt><dd>{value.value}<small>{value.source}</small></dd></div>)}</dl>
      <p>{tr('Bundled content fingerprint')}</p><code className="content-fingerprint">{report.fingerprint}</code>
      <label>{tr('Full definition')}<select className="field" value={document.key} onChange={event => setDocumentKey(event.target.value)}>
        {documents.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
      </select></label>
      <pre aria-label={document.label}>{document.text}</pre>
    </section>
  </div>
}
