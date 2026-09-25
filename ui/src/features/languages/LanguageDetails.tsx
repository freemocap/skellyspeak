import { ReadingLanguageScope } from '../../components/reading/ReadingLanguageScope'
import { TargetPhrase } from '../../components/reading/TargetPhrase'
import { ScriptSize } from './ScriptSize'
import { useSettingsStore } from '../../state/settings/settings'
import { useState } from 'react'
import { useI18n } from '../../components/localization/i18n'
import type { LanguageInspection } from '../../generated/contracts'
import { useReadingFont } from '../../platform/appearance/readingFont'

export function LanguageDetails({ report }: { report: LanguageInspection }) {
  const tr = useI18n()
  const readingFont = useReadingFont(report.language.nativeName, report.language.languageTag)
  const defaultScale = Number(report.values.find(value => value.field === 'font_scale')?.value ?? report.language.fontScale)
  const savedScale = useSettingsStore(state => state.settings?.script_scales?.[report.language.id])
  const scale = savedScale ?? defaultScale
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
  return <ReadingLanguageScope language={report.language.id} variety={report.varietyId}><div className="language-content">
    <p className="language-status"><span data-review={report.review}>{report.review === 'needs_review' ? tr('Linguistic review pending') : tr('Linguistically reviewed')}</span><span>{report.family}</span></p>
    <section className="language-writing"><h3>{tr('Writing and reading')}</h3>
      <dl className="language-writing-facts">{report.values.filter(value => value.field !== 'font_scale').map(value => <div key={value.field}><dt>{labels[value.field]}</dt><dd>{display(value.field, value.value)}</dd></div>)}
        <div><dt>{tr('Reading font')}</dt><dd title={readingFont.stack}>{readingFont.family || '—'}</dd></div>
      </dl>
      <ScriptSize language={report.language.id} defaultScale={defaultScale} />
      {report.schemes.length === 0 && <p>{tr('No romanization scheme configured')}</p>}
      <div className="language-schemes">
      {report.schemes.map(scheme => <article key={scheme.id}>
        <h4>{scheme.label}{scheme.selected && ` · ${tr('Default')}`}</h4>
        <div className="language-example-groups">{Array.from({ length: Math.ceil(scheme.examples.length / 4) }, (_, group) => <table key={group}><thead><tr><th>{tr('Original')}</th><th>{tr('Romanization')}</th></tr></thead><tbody>{scheme.examples.slice(group * 4, group * 4 + 4).map(([original, romanized], index) => <tr key={index}><td className="language-script-example" style={{fontSize: `calc(var(--type-reading) * ${scale})`}} lang={report.language.languageTag ?? undefined} dir={report.language.direction}><TargetPhrase text={original} /></td><td>{romanized}</td></tr>)}</tbody></table>)}</div>
        <details><summary>{tr('Romanization instructions')}</summary><p>{scheme.instructions}</p><p>{tr('Sources')}: {scheme.sources.join(', ')} · {scheme.review === 'needs_review' ? tr('Linguistic review pending') : tr('Linguistically reviewed')}</p></details>
      </article>)}
      </div>
    </section>
    {report.rules.length > 0 && <section><h3>{tr('Language-specific guidance')}</h3>{report.rules.map((rule,index) => <p key={index}>{rule.text}</p>)}</section>}
    <section><h3>{tr('Default conversation partner')}</h3><h4>{report.partner.name}</h4><p>{[report.partner.location, report.partner.occupation].filter(Boolean).join(' · ')}</p><p>{report.partner.background}</p><p>{report.partner.currentSituation}</p></section>
    <section className="language-definition"><h3>{tr('Full definition')}</h3>
      <h4>{tr('Resolved settings and sources')}</h4>
      <dl>{report.values.map(value => <div key={value.field}><dt>{value.field}</dt><dd>{value.value}<small>{value.source}</small></dd></div>)}</dl>
      <p>{tr('Bundled content fingerprint')}</p><code className="content-fingerprint">{report.fingerprint}</code>
      <label>{tr('Full definition')}<select className="field" value={document.key} onChange={event => setDocumentKey(event.target.value)}>
        {documents.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
      </select></label>
      <pre aria-label={document.label}>{document.text}</pre>
    </section>
  </div></ReadingLanguageScope>
}
