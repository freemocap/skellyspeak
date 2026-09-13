// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import type { CoachDecision } from '../../contracts'
import { EditFeedback } from './EditFeedback'

it('does not expose a generated hint merely by editing and displays only recorded exposure', () => {
  const decision: CoachDecision = { exposedMove: null, repairStatus: null, shown: { construct: 'past', quote: 'fue', move: 'hint', text: 'Which form goes with yo?' }, retryInvited: true, fixed: null, alsoNoticed: [], keptGoing: false }
  const view = render(<EditFeedback decision={decision} reviewing={false} error={undefined} />)
  expect(screen.queryByText('Which form goes with yo?')).toBeNull()
  expect(screen.getByRole('button', { name: 'Show help' })).toBeVisible()
  expect(view.container.querySelector('details')).toBeNull()
  view.rerender(<EditFeedback decision={{ ...decision, exposedMove: 'hint' }} reviewing={false} error={undefined} />)
  expect(screen.getByText('Which form goes with yo?')).toBeVisible()
})
