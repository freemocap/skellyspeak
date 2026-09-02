import { describe, expect, it } from 'vitest'
import { needsSpaceBetween } from './token-spacing'

describe('needsSpaceBetween', () => {
  it('no space before closing punctuation', () => {
    expect(needsSpaceBetween('hola', '!')).toBe(false)
    expect(needsSpaceBetween('estás', '?')).toBe(false)
  })

  it('no space after opening punctuation', () => {
    expect(needsSpaceBetween('¿', 'Qué')).toBe(false)
    expect(needsSpaceBetween('¡', 'Hola')).toBe(false)
  })

  it('space between words', () => {
    expect(needsSpaceBetween('Hola', 'mundo')).toBe(true)
  })
})
