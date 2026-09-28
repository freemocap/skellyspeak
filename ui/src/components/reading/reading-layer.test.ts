// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { readingLayerOrigin } from './reading-layer'
import { positionWordHelp } from './word-help-layer'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren() })

it('converts viewport coordinates to document coordinates after scrolling', () => {
  vi.stubGlobal('scrollX', 20)
  vi.stubGlobal('scrollY', 140)
  expect(readingLayerOrigin(document.body)).toEqual({ left: -20, top: -140 })
  const word = document.createElement('span'), card = document.createElement('span')
  document.body.append(word, card)
  vi.spyOn(word, 'getBoundingClientRect').mockReturnValue(new DOMRect(120, 300, 40, 30))
  vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 160, 70))
  positionWordHelp(card, word)
  expect(card.style.left).toBe('140px')
  expect(card.style.top).toBe('366px')
  card.setAttribute('popover', 'manual')
  positionWordHelp(card, word)
  expect(card.style.left).toBe('120px')
  expect(card.style.top).toBe('226px')
})

it('accounts for the border and scrolling of an owning dialog', () => {
  const dialog = document.createElement('dialog')
  dialog.style.position = 'fixed'
  const card = document.createElement('span'), word = document.createElement('span')
  dialog.append(word, card); document.body.append(dialog)
  vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue(new DOMRect(50, 100, 400, 500))
  Object.defineProperties(dialog, { clientLeft: { value: 2 }, clientTop: { value: 3 } })
  dialog.scrollTop = 40
  expect(readingLayerOrigin(dialog)).toEqual({ left: 52, top: 63 })
  vi.spyOn(word, 'getBoundingClientRect').mockReturnValue(new DOMRect(120, 300, 40, 30))
  vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 160, 70))
  positionWordHelp(card, word)
  expect(card.style.left).toBe('68px')
  expect(card.style.top).toBe('163px')
})
