// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { StoredTurn } from '../../../types'
import { LiveCoachReview } from './LiveCoachReview'
const makeTurn = (id: number, reply: string) => ({id,user:'Me gusta cocinar.',analysisState:'complete',assistant:{reply,tokens:[],user_tokens:[],errors:[],mechanics:[]},coachDecision:{exposedMove:null,repairStatus:null,shown:{construct:'verb',quote:'gusta',move:'hint',text:'Which verb form fits here?'},retryInvited:true,fixed:null,alsoNoticed:[],keptGoing:false}} as unknown as StoredTurn)
it('updates to the latest exchange and records visible hint exposure once', async () => {
  const control=vi.fn().mockResolvedValue(undefined)
  const view=render(<LiveCoachReview turn={makeTurn(1,'¿Qué cocinas?')} visible onControl={control} nativeLanguageName="English" rtl={false}/>)
  expect(screen.getByRole('region',{name:'Conversation coaching'})).toBeVisible()
  expect(screen.queryByText('¿Qué cocinas?')).toBeNull()
  await waitFor(()=>expect(control).toHaveBeenCalledExactlyOnceWith('open_card'))
  view.rerender(<LiveCoachReview turn={makeTurn(1,'¿Qué cocinas?')} visible onControl={control} nativeLanguageName="English" rtl={false}/>)
  expect(control).toHaveBeenCalledOnce()
  view.rerender(<LiveCoachReview turn={makeTurn(2,'Yo preparo arroz.')} visible onControl={control} nativeLanguageName="English" rtl={false}/>)
  expect(screen.queryByText('¿Qué cocinas?')).toBeNull()
  expect(screen.queryByText('Yo preparo arroz.')).toBeNull()
  await waitFor(()=>expect(control).toHaveBeenCalledTimes(2))
})
it('does not count help as viewed in a hidden mobile coach panel', () => {
  const control=vi.fn()
  render(<LiveCoachReview turn={makeTurn(1,'¿Qué cocinas?')} visible={false} onControl={control} nativeLanguageName="English" rtl={false}/>)
  expect(control).not.toHaveBeenCalled()
  expect(screen.queryByText('Which verb form fits here?')).toBeNull()
})

it('shows direct correction and explanation without an answer-reveal step', async () => {
  const control = vi.fn().mockResolvedValue(undefined)
  const turn = makeTurn(3, '¿Qué te gusta cocinar?')
  turn.conversationFeedback = { grammar: 4, conversation: 8, answers: {} }
  turn.coachDecision = { exposedMove: null, repairStatus: null, shown: { construct: 'event_roles', quote: 'Yo gusta', move: 'explicit', text: 'Me gusta', explanation: 'Use me gusta to say what you like.' }, retryInvited: false, fixed: null, alsoNoticed: [], keptGoing: false }
  const view = render(<LiveCoachReview turn={turn} visible onControl={control} nativeLanguageName="English" rtl={false} />)
  await waitFor(() => expect(control).toHaveBeenCalledExactlyOnceWith('open_card'))
  view.rerender(<LiveCoachReview turn={{ ...turn, coachDecision: { ...turn.coachDecision, exposedMove: 'explicit' } }} visible onControl={control} nativeLanguageName="English" rtl={false} />)
  expect(screen.getByText('Me gusta')).toBeVisible()
  expect(screen.getByText('Use me gusta to say what you like.')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Show answer' })).toBeNull()
  expect(screen.queryByText('¿Qué te gusta cocinar?')).toBeNull()
})
