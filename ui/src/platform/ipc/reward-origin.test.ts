// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import type { EffortAward } from '../../generated/contracts'
import * as rewards from './reward-origin'
let stop: () => void
let observe = vi.fn<(reward: rewards.ActionReward) => void>()
let unsubscribe: () => void
const award = (id: string, sourceId = id, at = Date.now()): EffortAward => ({ id, sourceId, dimension: 'explorations', language: 'spanish', variety: 'standard', conversationId: null, policy: 'test', createdAt: new Date(at).toISOString(), claimed: false })
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-01T12:00:00Z'))
  observe = vi.fn()
  stop = rewards.trackRewardActivations()
  unsubscribe = rewards.onActionReward(observe)
})
afterEach(() => { stop(); unsubscribe(); vi.useRealTimers(); document.body.replaceChildren() })
function click(x: number, y: number) { document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1, clientX: x, clientY: y })) }
it('waits for an earned award and keeps concurrent results at their own initiating clicks', () => {
  click(10, 20); rewards.bindRewardOrigin('first')
  click(90, 80); rewards.bindRewardOrigin('second')
  expect(observe).not.toHaveBeenCalled()
  vi.advanceTimersByTime(10_000)
  rewards.publishEffortAwards([award('second'), award('first')])
  expect(observe.mock.calls.map(([event]) => [event.award.id, event.origin.x, event.origin.y])).toEqual([['second', 90, 80], ['first', 10, 20]])
  rewards.publishEffortAwards([award('second')])
  expect(observe).toHaveBeenCalledTimes(2)
})
it('handles publication racing ahead of the command receipt', () => {
  click(25, 30)
  const origin = rewards.captureRewardOrigin()
  vi.advanceTimersByTime(20)
  rewards.publishEffortAwards([award('race')])
  rewards.bindRewardOrigin('race', origin)
  expect(observe).toHaveBeenCalledWith(expect.objectContaining({ origin }))
})
it('does not animate historical awards when saved information is reopened', () => {
  const old = award('saved', 'saved', Date.now() - 5000)
  rewards.publishEffortAwards([old])
  click(20, 30); rewards.bindRewardOrigin('saved')
  rewards.publishEffortAwards([old])
  expect(observe).not.toHaveBeenCalled()
})
it('does not use an unrelated stale click for a background action', () => {
  click(20, 30)
  vi.advanceTimersByTime(1001)
  rewards.bindRewardOrigin('background')
  rewards.publishEffortAwards([award('background')])
  expect(observe).not.toHaveBeenCalled()
})
it('propagates the initiating turn to its operation, including clarification sources', () => {
  click(60, 70); rewards.bindRewardOrigin('turn')
  rewards.inheritRewardOrigin('operation', 'turn')
  rewards.publishEffortAwards([award('clarification', 'operation:digest')])
  expect(observe).toHaveBeenCalledWith(expect.objectContaining({ origin: expect.objectContaining({ x: 60, y: 70 }) }))
})
it('anchors keyboard activation at the focused control', () => {
  const button = document.createElement('button'); document.body.append(button)
  button.getBoundingClientRect = () => ({ left: 100, top: 200, width: 40, height: 30 }) as DOMRect
  button.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }))
  expect(rewards.captureRewardOrigin()).toEqual({ x: 120, y: 215, at: Date.now() })
  button.click()
  expect(rewards.captureRewardOrigin()).toEqual({ x: 120, y: 215, at: Date.now() })
})
