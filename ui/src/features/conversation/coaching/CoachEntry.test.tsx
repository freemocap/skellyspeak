// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { CoachEntry } from './CoachEntry'
it('shows useful language explanations immediately, without internal metrics or nested disclosure', () => {
  const view = render(<CoachEntry source="Sí, me gusta cocinar." feedback={{meaningRecovered:'full',candidatesSent:46,itemsReturned:1,items:[{construct:'event_roles',outcome:'demonstrated',quote:'me gusta cocinar',rationale:'Me gusta followed by an infinitive means “I like doing something.” Cocinar means “to cook.”'}]}} />)
  expect(screen.getByText(/Me gusta followed/)).toBeVisible()
  expect(view.container.querySelector('details')).toBeNull()
  expect(view.container.textContent).not.toMatch(/Meaning recovered|Candidate constructs|Returned items|event_roles|demonstrated/)
})
it('shows original, correction and why only after the explicit answer is exposed', () => {
  const decision = {exposedMove:'explicit' as const,repairStatus:null,shown:{construct:'spelling',quote:'cosenar',move:'explicit' as const,text:'cocinar',explanation:'Cocinar means “to cook.” The verb ends in -ar.'},retryInvited:false,fixed:null,alsoNoticed:[],keptGoing:false}
  const view = render(<CoachEntry source={null} decision={decision} />)
  expect(view.container.querySelector('s')).toHaveTextContent('cosenar')
  expect(view.container.querySelector('strong')).toHaveTextContent('cocinar')
  expect(screen.getByText(/Cocinar means/)).toBeVisible()
  view.rerender(<CoachEntry source={null} decision={{...decision,exposedMove:null}} />)
  expect(screen.queryByText('cocinar')).toBeNull()
  expect(screen.queryByText(/Cocinar means/)).toBeNull()
})

it('renders no suggestion for evidence-only success and at most one for retained feedback', () => {
  const item = {construct:'question',outcome:'demonstrated' as const,quote:'¿Cómo estás?',rationale:''}
  const feedback = {meaningRecovered:'full' as const,candidatesSent:2,itemsReturned:2,items:[item,{...item,construct:'greeting'}]}
  const view = render(<CoachEntry source={null} feedback={feedback} />)
  expect(view.container.querySelectorAll('.coach-card')).toHaveLength(0)
  expect(view.container.textContent).toBe('')
  view.rerender(<CoachEntry source={null} feedback={{...feedback,items:feedback.items.map(i => ({...i,rationale:'One short tip.'}))}} />)
  expect(view.container.querySelectorAll('.coach-card')).toHaveLength(1)
})
