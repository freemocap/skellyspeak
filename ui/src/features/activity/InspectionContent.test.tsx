// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { InspectionContent } from './InspectionContent'

it('renders structured content and embedded prompt data without hiding values', () => {
  const text = 'Instructions\n\nPersona background (data): {"name":"نور","facts":["**A fact**","Another fact"],"enabled":false,"missing":null}\n\nContinue here.'
  const view = render(<InspectionContent text={text} mode="readable" />)
  expect(screen.getByText('نور')).toBeInTheDocument()
  expect(screen.getByText('A fact').closest('strong')).not.toBeNull()
  expect(screen.getByText('false')).toBeInTheDocument()
  expect(screen.getByText('null')).toBeInTheDocument()
  expect(screen.getByText('Continue here.')).toBeInTheDocument()
  view.rerender(<InspectionContent text={text} mode="source" />)
  expect(view.container.querySelector('pre')?.textContent).toBe(text)
})

it('renders markdown in JSON strings and preserves hostile HTML as inert text', () => {
  const text = JSON.stringify({ explanation: '# Heading\n\n**Important**\n\n- First\n- Second', content: '<img src="https://example.com/pixel" onerror="alert(1)">' })
  const { container } = render(<InspectionContent text={text} mode="readable" />)
  expect(screen.getByText('Important').closest('strong')).not.toBeNull()
  expect(container.querySelectorAll('li')).toHaveLength(2)
  expect(container.querySelector('img, script, iframe')).toBeNull()
  expect(container.textContent).toContain('<img src=')
})

it('keeps incomplete streaming JSON and deeply nested structures inspectable', () => {
  const view = render(<InspectionContent text={'{"response":"unfinished'} mode="readable" />)
  expect(view.container.textContent).toContain('{"response":"unfinished')
  let value: unknown = 'leaf'
  for (let i = 0; i < 30; i++) value = { nested: value }
  view.rerender(<InspectionContent text={JSON.stringify(value)} mode="readable" />)
  expect(view.container.textContent).toContain('leaf')
})

it('breaks a dense system prompt into paragraphs and expands JSON in mid-paragraph', () => {
  const text = 'Conversation support v4. Explain zero to two useful grammar or usage patterns in actualPartnerReply. Each card must quote actual partner wording verbatim and give a short title, explanation, target-language example and a useful contrast. Do not assess the learner here. Writing guidance for quoted target text only: {"assessment":["Use Spanish","Keep quoted {braces} and \\\"quotes\\\" intact"],"reading":["Use Spanish"]}. The learner native language is English. All explanations must use English.'
  const view = render(<InspectionContent text={text} mode="readable" />)
  expect(screen.getByText('assessment').tagName).toBe('DT')
  expect(screen.getByText('reading').tagName).toBe('DT')
  expect(view.container.querySelectorAll('p').length).toBeGreaterThan(4)
  expect(view.container.textContent).toContain('The learner native language is English.')
  expect(view.container.textContent).toContain('Keep quoted {braces}')
  view.rerender(<InspectionContent text={text} mode="source" />)
  expect(view.container.querySelector('pre')?.textContent).toBe(text)
})
