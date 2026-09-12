import { expect, it } from 'vitest'
import sequences from '../../../test-fixtures/emoji.json'
import { isEmoji } from './personaLimits'

it.each(sequences as [string, boolean][])('validates the shared emoji sequence %j as %s', (value, expected) => {
  expect(isEmoji(value)).toBe(expected)
})
