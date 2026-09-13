// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { StoredTurn } from '../../types'
import { LiveCoachReview } from './LiveCoachReview'
const makeTurn = (id: number, reply: string) => ({id,user:'Me gusta cocinar.',analysisState:'complete',assistant:{reply,tokens:[],user_tokens:[],errors:[],mechanics:[]},coachDecision:{exposedMove:null,repairStatus:null,shown:{construct:'verb',quote:'gusta',move:'hint',text:'Which verb form fits here?'},retryInvited:true,fixed:null,alsoNoticed:[],keptGoing:false}} as unknown as StoredTurn)
it('updates to the latest exchange and records visible hint exposure once', async () => {
  const control=vi.fn().mockResolvedValue(undefined)
  const view=render(<LiveCoachReview turn={makeTurn(1,'¿Qué cocinas?')} visible onControl={control} nativeLanguageName="English" rtl={false}/>)
  expect(screen.getByRole('region',{name:'Conversation coaching'})).toBeVisible()
  expect(screen.getByText('¿Qué cocinas?')).toBeVisible()
  await waitFor(()=>expect(control).toHaveBeenCalledExactlyOnceWith('open_card'))
  view.rerender(<LiveCoachReview turn={makeTurn(1,'¿Qué cocinas?')} visible onControl={control} nativeLanguageName="English" rtl={false}/>)
  expect(control).toHaveBeenCalledOnce()
  view.rerender(<LiveCoachReview turn={makeTurn(2,'Yo preparo arroz.')} visible onControl={control} nativeLanguageName="English" rtl={false}/>)
  expect(screen.queryByText('¿Qué cocinas?')).toBeNull()
  expect(screen.getByText('Yo preparo arroz.')).toBeVisible()
  await waitFor(()=>expect(control).toHaveBeenCalledTimes(2))
})
it('does not count help as viewed in a hidden mobile coach panel', () => {
  const control=vi.fn()
  render(<LiveCoachReview turn={makeTurn(1,'¿Qué cocinas?')} visible={false} onControl={control} nativeLanguageName="English" rtl={false}/>)
  expect(control).not.toHaveBeenCalled()
  expect(screen.queryByText('Which verb form fits here?')).toBeNull()
})
