// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { expect, it } from 'vitest'
import { MixedText } from './MixedText'

it.each([
  ['بَدّي أزور مَسْكَنَك بَكّير', '(Baddī azūr maskanak bakīr.) — I want to visit your place early.'],
  ['你喜欢科幻小说吗', '(Nǐ xǐhuān kēhuàn xiǎoshuō ma?) — Do you like science fiction?'],
])('isolates %s from Latin reading aids without changing source text', (source, explanation) => {
  const text = `${source}. ${explanation}`
  const { container } = render(<MixedText text={text} />)
  expect(container.textContent).toBe(text)
  expect(container.querySelector('bdi')?.textContent).toBe(source)
  expect(container.querySelector('.target-text')?.textContent).not.toContain(explanation)
})
