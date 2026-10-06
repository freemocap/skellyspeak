import { GuideActions } from './GuideActions'
import type { GuideContext } from '../../generated/contracts'
import { useI18n } from '../localization/i18n'
import { Fragment, type ReactNode } from 'react'
import { Markdown } from '../reading/Markdown'
import { TargetPassage } from '../reading/TargetPassage'

/** One `###` subskill section of a guide while its blocks are collected. */
interface Section { key: number; heading: string; subskill: string | undefined; body: ReactNode[] }

/** Authored guide Markdown: blockquotes are explicitly target-language examples.
 * Each `###` subskill heading opens a section that runs to the next heading;
 * the section's actions follow its explanation and examples. Content and order
 * are the Markdown's own. Keep the coach's deliberately compact Markdown
 * renderer independent. */
export function GuideDocument({ text, context }: { text: string; context?: GuideContext | null }) {
  const tr = useI18n()
  const [lesson, editorial] = text.split('\n\n## Editorial notes\n\n')
  const blocks = lesson.trim().split(/\n\n+/)
  let sectionIndex = 0
  let exampleIndex = 0
  const top: ReactNode[] = []
  let section: Section | null = null as Section | null
  const sections: { at: number; section: Section }[] = []
  blocks.forEach((block, index) => {
    const heading = /^(#{1,3}) (.+)$/.exec(block)
    if (heading) {
      if (heading[1].length === 3) {
        const opened: Section = { key: index, heading: heading[2], subskill: context?.subskills[sectionIndex++], body: [] }
        section = opened
        sections.push({ at: top.length, section: opened })
        top.push(null)
        return
      }
      section = null
      const Tag = heading[1].length === 1 ? 'h3' : 'h4'
      top.push(<Tag key={index}>{heading[2]}</Tag>)
      return
    }
    let node: ReactNode
    if (block.startsWith('> ')) {
      const text = block.replace(/^> ?/gm, '')
      const candidate = exampleIndex++
      const example = context?.examples[candidate] === text ? candidate : -1
      node = <Fragment key={index}><TargetPassage text={text} />{context && example >= 0 && <div className="skill-guide-actions"><GuideActions guide={context.reference} example={example} /></div>}</Fragment>
    } else node = <Fragment key={index}><Markdown text={block} targetCode /></Fragment>
    if (section) section.body.push(node)
    else top.push(node)
  })
  for (const { at, section: item } of sections) top[at] = <section key={item.key} className="skill-guide-section">
    <h5>{item.heading}</h5>
    {item.body}
    {context && item.subskill && <div className="skill-guide-actions"><GuideActions guide={context.reference} subskill={item.subskill} /></div>}
  </section>
  return <article className="skill-guide-document">
    {top}
    {editorial && <details className="skill-guide-editorial"><summary>{tr('Editorial notes')}</summary><Markdown text={editorial} /></details>}
  </article>
}
