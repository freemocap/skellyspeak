// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { SkillRewards } from './SkillRewards'
import { SkillEvidenceContext } from '../../hooks/useSkillEvidence'
import { skillDemo } from '../../lib/skillDemo'
import { unreportedInput, type SkillSnapshot } from '../../lib/skills'

it('silently loads history, announces new credit, and clears it on chat changes', () => {
  const media = vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList)
  vi.useFakeTimers()
  const snapshot = structuredClone(skillDemo)
  const ui = (value: SkillSnapshot, chatId = 'chat') => <SkillEvidenceContext value={{ snapshot: value, error: null }}><SkillRewards chatId={chatId} active={true} workspace={{ current: null }} /></SkillEvidenceContext>
  const view = render(ui(snapshot))
  try {
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    const next = structuredClone(snapshot)
    next.records = [{ attempt_id: 'a', session_id: 's', turn_id: 1, message_id: 1, replaces_message_id: null, chat_id: 'chat', learner_id: 'demo', target: 'es-ES', native: 'en', source: 'Ese café.', input: unreportedInput(), at_secs: 1, model: 'test', provider_mode: 'hosted', catalog_version: 3, prompt_version: 'test', status: 'complete', error: null, assessment: { judgments: [{ skill_id: 'referent', outcome: 'demonstrated', quotes: ['Ese café'], rationale: 'Identifies the coffee.' }] } }]
    next.profile.credits = [{ attempt_id: 'a', skill_id: 'referent', xp: 10 }]
    next.profile.skills.find(skill => skill.skill_id === 'referent')!.xp = 10
    view.rerender(ui(next))
    expect(screen.getByRole('status')).toHaveTextContent('10 XP for Identify a referent: Ese café')
    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    view.rerender(ui(structuredClone(next)))
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    view.rerender(ui(snapshot, 'another-chat'))
    view.rerender(ui(next, 'chat'))
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  } finally { view.unmount(); media.mockRestore(); vi.useRealTimers() }
})
