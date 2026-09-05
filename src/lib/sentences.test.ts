import { describe, expect, it } from 'vitest'
import type { GuidedToken } from '../types'
import { groupSentences, splitSentences } from './sentences'

const t = (text: string): GuidedToken => ({
  text,
  gloss: null,
  pos: null,
  notable: false,
  romanization: null,
})

describe('groupSentences', () => {
  it('splits on terminal punctuation, keeping punct-only tokens', () => {
    const tokens = ['¡Hola', 'Juan', '?', '¿Cómo', 'estás', '?'].map(t)
    const s = groupSentences(tokens)
    expect(s).toHaveLength(2)
    expect(s[0].map((x) => x.text)).toEqual(['¡Hola', 'Juan', '?'])
    expect(s[1].map((x) => x.text)).toEqual(['¿Cómo', 'estás', '?'])
  })

  it('attached punctuation closes the sentence ("¡Hola!")', () => {
    const s = groupSentences(['¡Hola!', '¿Cómo', 'estás', '?'].map(t))
    expect(s).toHaveLength(2)
    expect(s[0].map((x) => x.text)).toEqual(['¡Hola!'])
  })

  it('handles attached punctuation ("hoy?")', () => {
    const s = groupSentences(['¿Y', 'tú?'].map(t))
    expect(s).toHaveLength(1)
    expect(s[0].map((x) => x.text)).toEqual(['¿Y', 'tú?'])
  })

  it('returns empty for no tokens', () => {
    expect(groupSentences([])).toEqual([])
  })

  it('keeps a trailing fragment without terminal punctuation', () => {
    const s = groupSentences(['Hola', 'mundo'].map(t))
    expect(s).toHaveLength(1)
  })

  it('splits on CJK terminators (。！？)', () => {
    const s = groupSentences(['你好', '吗？', '我', '很好。'].map(t))
    expect(s).toHaveLength(2)
    expect(s[0].map((x) => x.text)).toEqual(['你好', '吗？'])
    expect(s[1].map((x) => x.text)).toEqual(['我', '很好。'])
  })
})

describe('splitSentences', () => {
  it('mirrors groupSentences counts for aligned text', () => {
    expect(splitSentences('¡Hola! ¿Cómo estás?')).toHaveLength(2)
  })

  it('handles ellipses and no trailing punctuation', () => {
    expect(splitSentences('Bueno…')).toEqual(['Bueno…'])
    expect(splitSentences('Hola mundo')).toEqual(['Hola mundo'])
    expect(splitSentences('')).toEqual([])
  })

  it('splits CJK text on 。！？', () => {
    expect(splitSentences('你好吗？我很好。')).toEqual(['你好吗？', '我很好。'])
  })
})
