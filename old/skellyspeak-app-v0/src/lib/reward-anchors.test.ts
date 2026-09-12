// @vitest-environment jsdom
import { expect, it } from 'vitest'
import { rewardAnchor, visibleRewardRect } from './reward-anchors'

it('rejects clipped, hidden and other-workspace anchors and finds visible overlapping evidence', () => {
  const scope = document.createElement('div')
  const clip = document.createElement('div')
  const hidden = document.createElement('span')
  const visible = document.createElement('span')
  document.body.append(scope)
  scope.append(clip)
  clip.append(hidden, visible)
  clip.style.overflowY = 'auto'
  clip.getBoundingClientRect = () => new DOMRect(0, 100, 300, 100)
  hidden.getBoundingClientRect = () => new DOMRect(0, 20, 100, 20)
  visible.getBoundingClientRect = () => new DOMRect(0, 180, 100, 40)
  for (const element of [hidden, visible]) element.dataset.rewardEvidence = JSON.stringify(['a:referent', 'a:property'])
  expect(visibleRewardRect(hidden, scope)).toBeNull()
  expect(rewardAnchor(scope, 'evidence', 'a:property')).toEqual(new DOMRect(0, 180, 100, 20))
  expect(visibleRewardRect(visible, document.createElement('div'))).toBeNull()
  scope.setAttribute('aria-hidden', 'true')
  expect(rewardAnchor(scope, 'evidence', 'a:property')).toBeNull()
  scope.remove()
})
