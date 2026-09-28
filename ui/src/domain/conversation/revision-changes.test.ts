import { expect, it } from 'vitest'
import { revisionChanges } from './revision-changes'

it('counts no change for the same words, whatever the spacing', () => {
  expect(revisionChanges('Me gustan los tacos.', 'Me gustan los tacos.')).toBe(0)
  expect(revisionChanges('Me gustan  los tacos.', ' Me gustan los tacos. ')).toBe(0)
})

it('counts one replaced run of words as one change', () => {
  expect(revisionChanges('Sí, me gustan los aguacates. Me gustan… son… los tacos.', 'Sí, me gustan los aguacates. También me gustan los tacos.')).toBe(1)
})

it('counts separate runs separately', () => {
  expect(revisionChanges('Yo fue a la playa ayer', 'Yo fui a la playa hoy')).toBe(2)
})

it('counts added and removed words', () => {
  expect(revisionChanges('Me gusta cocinar', 'Me gusta mucho cocinar')).toBe(1)
  expect(revisionChanges('Me gusta mucho cocinar', 'Me gusta cocinar')).toBe(1)
  expect(revisionChanges('', 'Hola')).toBe(1)
  expect(revisionChanges('Hola', '')).toBe(1)
})

it('treats a change in case or punctuation as a change', () => {
  expect(revisionChanges('me gustan', 'Me gustan')).toBe(1)
  expect(revisionChanges('los tacos', 'los tacos.')).toBe(1)
})
