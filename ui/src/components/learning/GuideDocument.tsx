import { GuideActions } from './GuideActions'
import type { GuideContext } from '../../generated/contracts'
import { useI18n } from '../localization/i18n'
import { Fragment } from 'react'
import { Markdown } from '../reading/Markdown'
import { TargetPassage } from '../reading/TargetPassage'

/** Authored guide Markdown: blockquotes are explicitly target-language examples.
 * Keep the coach's deliberately compact Markdown renderer independent. */
export function GuideDocument({ text, context }: { text: string; context?: GuideContext | null }) {
  const tr = useI18n()
  const [lesson, editorial] = text.split('\n\n## Editorial notes\n\n')
  const blocks = lesson.trim().split(/\n\n+/)
  let sectionIndex = 0
  let exampleIndex = 0
  return <article className="skill-guide-document">
    {blocks.map((block, index) => {
      const heading = /^(#{1,3}) (.+)$/.exec(block)
      if (heading) {
        const Tag = heading[1].length === 1 ? 'h3' : heading[1].length === 2 ? 'h4' : 'h5'
        const subskill = heading[1].length === 3 ? context?.subskills[sectionIndex++] : undefined
        return <Fragment key={index}><Tag>{heading[2]}</Tag>{context && subskill && <GuideActions guide={context.reference} subskill={subskill} />}</Fragment>
      }
      if (block.startsWith('> ')) {
        const text = block.replace(/^> ?/gm, '')
        const candidate = exampleIndex++
        const example = context?.examples[candidate] === text ? candidate : -1
        return <Fragment key={index}><TargetPassage text={text} />{context && example >= 0 && <GuideActions guide={context.reference} example={example} />}</Fragment>
      }
      return <Fragment key={index}><Markdown text={block} targetCode /></Fragment>
    })}
    {editorial && <details className="skill-guide-editorial"><summary>{tr('Editorial notes')}</summary><Markdown text={editorial} /></details>}
  </article>
}
