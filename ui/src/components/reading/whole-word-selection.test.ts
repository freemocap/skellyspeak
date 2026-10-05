// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { wholeWordSelection } from './whole-word-selection'

afterEach(() => { window.getSelection()!.removeAllRanges(); document.body.replaceChildren() })

function fixture() {
  const root = document.createElement('span')
  root.innerHTML = '<span data-speech-source>cat </span><b><span data-speech-source>scatter</span><span>meaning</span></b><span data-speech-source> cat</span>'
  document.body.append(root)
  return { root, nodes: Array.from(root.querySelectorAll('[data-speech-source]')).map(element => element.firstChild!), selection: window.getSelection()! }
}

it('retains the selected occurrence and backward direction', () => {
  const { root, nodes, selection } = fixture()
  selection.setBaseAndExtent(nodes[1], 4, nodes[1], 1)
  expect(wholeWordSelection(root, 'cat scatter cat', selection)).toBe('scatter')
  expect(selection.anchorNode).toBe(nodes[1])
  expect(selection.anchorOffset).toBe(7)
  expect(selection.focusNode).toBe(nodes[1])
  expect(selection.focusOffset).toBe(0)
})

it('maps element endpoints while excluding reading aid text', () => {
  const { root, selection } = fixture()
  const range = document.createRange(); range.selectNodeContents(root)
  selection.addRange(range)
  expect(wholeWordSelection(root, 'cat scatter cat', selection)).toBe('cat scatter cat')
})

it('does not interpret annotations, collapsed selections or mismatched rendering as source', () => {
  const { root, nodes, selection } = fixture()
  const aid = root.querySelector('b')!.lastChild!.firstChild!
  selection.setBaseAndExtent(aid, 0, aid, 3)
  expect(wholeWordSelection(root, 'cat scatter cat', selection)).toBeNull()
  selection.setBaseAndExtent(nodes[1], 1, nodes[1], 1)
  expect(wholeWordSelection(root, 'cat scatter cat', selection)).toBeNull()
  selection.setBaseAndExtent(nodes[1], 1, nodes[1], 4)
  expect(wholeWordSelection(root, 'different source', selection)).toBeNull()
})
