// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { findTourTarget, useTourTarget } from './tourTarget'

function rect(width: number, height: number): DOMRect {
  return { x: 0, y: 0, width, height, top: 0, left: 0, right: width, bottom: height, toJSON: () => ({}) } as DOMRect
}

afterEach(() => { document.body.innerHTML = '' })

it('picks the first selector with a visible match', () => {
  document.body.innerHTML = '<div class="a"></div><div class="b"></div>'
  document.querySelector('.a')!.getBoundingClientRect = () => rect(0, 0)
  document.querySelector('.b')!.getBoundingClientRect = () => rect(10, 10)
  expect(findTourTarget(['.a', '.b'], document)).toBe(document.querySelector('.b'))
})

it('skips a selector with no match at all', () => {
  document.body.innerHTML = '<div class="b"></div>'
  document.querySelector('.b')!.getBoundingClientRect = () => rect(10, 10)
  expect(findTourTarget(['.missing', '.b'], document)).toBe(document.querySelector('.b'))
})

it('returns null when nothing in the chain is visible', () => {
  document.body.innerHTML = '<div class="a"></div>'
  document.querySelector('.a')!.getBoundingClientRect = () => rect(0, 0)
  expect(findTourTarget(['.a'], document)).toBeNull()
})

it('is scoped to its root: two demos on the map never cross-match', () => {
  document.body.innerHTML = '<div id="one"><div class="word"></div></div><div id="two"><div class="word"></div></div>'
  const first = document.querySelector('#one .word')!, second = document.querySelector('#two .word')!
  first.getBoundingClientRect = () => rect(5, 5)
  second.getBoundingClientRect = () => rect(5, 5)
  expect(findTourTarget(['.word'], document.querySelector('#two')!)).toBe(second)
})

it('tracks the live target across frames, including once it appears', async () => {
  document.body.innerHTML = '<div class="fallback"></div>'
  document.querySelector('.fallback')!.getBoundingClientRect = () => rect(5, 5)
  const { result } = renderHook(() => useTourTarget(['.specific', '.fallback'], document))
  await act(async () => { await new Promise(resolve => requestAnimationFrame(resolve)) })
  expect(result.current?.element).toBe(document.querySelector('.fallback'))

  const specific = document.createElement('div')
  specific.className = 'specific'
  specific.getBoundingClientRect = () => rect(20, 20)
  document.body.appendChild(specific)
  await act(async () => { await new Promise(resolve => requestAnimationFrame(resolve)) })
  expect(result.current?.element).toBe(specific)
})

it('reports nothing found while its root is not yet mounted', () => {
  const { result } = renderHook(() => useTourTarget(['.anything'], null))
  expect(result.current).toBeNull()
})
