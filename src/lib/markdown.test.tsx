// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Markdown } from './markdown'

function html(text: string): string {
  const { container } = render(<Markdown text={text} />)
  return container.innerHTML
}

describe('rendering coach text', () => {
  it('renders plain prose as a paragraph', () => {
    expect(html('Nice work on the past tense.')).toBe(
      '<p class="md-p">Nice work on the past tense.</p>'
    )
  })

  it('renders bold, italic and inline code', () => {
    const out = html('Say **hola** not *ola*, and `ser` not `estar`.')
    expect(out).toContain('<strong>hola</strong>')
    expect(out).toContain('<em>ola</em>')
    expect(out).toContain('<code>ser</code>')
  })

  it('does not read **bold** as an empty italic', () => {
    // The naive single-asterisk pattern matches first inside `**x**` and
    // produces `<em></em>x<em></em>`.
    expect(html('**importante**')).toBe('<p class="md-p"><strong>importante</strong></p>')
  })

  it('keeps the line breaks the coach wrote', () => {
    // Markdown proper folds these into one line. Three short observations on
    // three lines are three lines.
    expect(html('one\ntwo')).toBe('<p class="md-p">one<br>two</p>')
  })

  it('separates paragraphs on a blank line', () => {
    const out = html('first\n\nsecond')
    expect(out).toBe('<p class="md-p">first</p><p class="md-p">second</p>')
  })

  it('renders bullet lists', () => {
    const out = html('Try:\n- el libro\n- la mesa')
    expect(out).toContain('<p class="md-p">Try:</p>')
    expect(out).toContain('<ul class="md-list">')
    expect(out).toContain('<li>el libro</li>')
    expect(out).toContain('<li>la mesa</li>')
  })

  it('renders fenced code blocks', () => {
    expect(html('```\nyo hablo\n```')).toBe('<pre class="md-code">yo hablo</pre>')
  })

  it('keeps the text of an unterminated fence rather than dropping it', () => {
    // A truncated stream should not silently swallow the sentence.
    expect(html('```\nyo hablo')).toContain('yo hablo')
  })

  it('shows a heading as bold rather than printing the hashes', () => {
    const out = html('## Corrections')
    expect(out).toContain('<strong>Corrections</strong>')
    expect(out).not.toContain('##')
  })

  it('renders nothing for empty or whitespace-only text', () => {
    expect(html('')).toBe('')
    expect(html('   \n  ')).toBe('')
  })
})

describe('not trusting model output', () => {
  it('escapes HTML instead of executing it', () => {
    // This renders text that came from a provider. React escapes it because
    // these are elements, not `dangerouslySetInnerHTML`.
    const out = html('<img src=x onerror="alert(1)"> and <b>bold</b>')
    expect(out).not.toContain('<img')
    expect(out).not.toContain('<b>')
    expect(out).toContain('&lt;img')
  })

  it('shows a stray asterisk as itself', () => {
    render(<Markdown text="2 * 3 = 6" />)
    expect(screen.getByText('2 * 3 = 6')).toBeInTheDocument()
  })

  it('leaves snake_case identifiers alone', () => {
    // Treating `_` as emphasis would mangle every identifier the coach quotes.
    expect(html('used_target and used_native')).toBe(
      '<p class="md-p">used_target and used_native</p>'
    )
  })
})

describe('curiosity markers', () => {
  it('turns a [[bracketed term]] into something you can press', () => {
    // The prompt is only allowed to ask the coach for these because pressing
    // one really does ask about that term. A marker that did nothing would be
    // decoration dressed as an affordance.
    const asked = vi.fn()
    render(<Markdown text="Watch out for the [[subjunctive]] here." onTerm={asked} />)
    const term = screen.getByRole('button', { name: 'subjunctive' })
    fireEvent.click(term)
    expect(asked).toHaveBeenCalledWith('subjunctive')
  })

  it('renders a marker as plain words when nothing can be asked', () => {
    // A button nobody can press should look like text, and the reader should
    // never see the raw brackets either way.
    const out = html('Watch out for the [[subjunctive]] here.')
    expect(out).toBe('<p class="md-p">Watch out for the subjunctive here.</p>')
    expect(out).not.toContain('[[')
  })

  it('handles several markers in one line, and markup around them', () => {
    const asked = vi.fn()
    render(
      <Markdown
        text="**Two** rabbit holes: [[el voseo]] and [[the Real Academia]]."
        onTerm={asked}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'el voseo' }))
    fireEvent.click(screen.getByRole('button', { name: 'the Real Academia' }))
    expect(asked.mock.calls.map((c) => c[0])).toEqual(['el voseo', 'the Real Academia'])
  })

  it('works inside bullets, where the coach usually lists them', () => {
    const asked = vi.fn()
    render(<Markdown text={'- one thing\n- and [[the other]]'} onTerm={asked} />)
    fireEvent.click(screen.getByRole('button', { name: 'the other' }))
    expect(asked).toHaveBeenCalledWith('the other')
  })

  it('leaves an unclosed or empty marker as the text it is', () => {
    // Model output. A half-written marker must not swallow the rest of the
    // sentence, and it must not become a button with no name.
    expect(html('An [[unclosed marker and more text')).toContain('[[unclosed marker')
    expect(html('An empty [[]] marker')).toContain('[[]]')
  })
})
