import { useI18n } from '../localization/i18n'
import { Fragment } from 'react'
import { Markdown } from '../reading/Markdown'
import { TargetPassage } from '../reading/TargetPassage'

/** Authored guide Markdown: blockquotes are explicitly target-language examples.
 * Keep the coach's deliberately compact Markdown renderer independent. */
export function GuideDocument({ text }: { text: string }) {
  const tr = useI18n()
  const [lesson, editorial] = text.split('\n\n## Editorial notes\n\n')
  const blocks = lesson.trim().split(/\n\n+/)
  return <article className="skill-guide-document">
    {blocks.map((block, index) => {
      const heading = /^(#{1,3}) (.+)$/.exec(block)
      if (heading) {
        const Tag = heading[1].length === 1 ? 'h3' : heading[1].length === 2 ? 'h4' : 'h5'
        return <Tag key={index}>{heading[2]}</Tag>
      }
      if (block.startsWith('> ')) return <TargetPassage key={index} text={block.replace(/^> ?/gm, '')} />
      return <Fragment key={index}><Markdown text={block} targetCode /></Fragment>
    })}
    {editorial && <details className="skill-guide-editorial"><summary>{tr('Editorial notes')}</summary><Markdown text={editorial} /></details>}
  </article>
}
