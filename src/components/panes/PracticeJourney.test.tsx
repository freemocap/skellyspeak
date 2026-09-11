import { ReadingPreferencesContext } from '../ReadingPreferences'
// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { expect, it, vi } from 'vitest'
import { SkillPracticeBoard } from './SkillPracticeBoard'
import { PracticeContext, DraftAssistanceContext } from './PracticeContext'
import { TopicNotesProvider } from './TopicNotesProvider'
import { SkillNavigationProvider, useSkillNavigation } from '../../hooks/useSkillNavigation'
import { SkillEvidenceContext } from '../../hooks/useSkillEvidence'
import { ConversationMap } from '../chat/ConversationMap'
import { SkillTreeView } from '../../pages/SkillsPage'
import { skillDemo } from '../../lib/skillDemo'

const backend = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('../../lib/tauri', () => ({ invoke: backend.invoke, isTauri: true }))
vi.mock('../../lib/back', () => ({ openOverlay: () => () => {} }))

function Journey() {
  const navigation = useSkillNavigation()
  const [draft, setDraft] = useState('My draft')
  const [inMap, setInMap] = useState(false)
  const map = inMap || !!navigation.state.mapRequest
  return <TopicNotesProvider scope="es:en"><SkillEvidenceContext value={{ snapshot: skillDemo, error: null }}>
    <PracticeContext value={{ chatId: 'chat', selected: navigation.state.selected?.skillId ?? null, selectionVersion: navigation.state.sequence, select: skillId => navigation.select({ target: skillDemo.target, skillId }) }}>
      <DraftAssistanceContext value={{ suggestions: { replies: [], frames: [], starters: [], coach_help: null }, suggestionsError: null, useExample: text => setDraft(value => `${value} ${text}`) }}>
        <input aria-label="Draft" value={draft} onChange={event => setDraft(event.target.value)} />
        {!map && <><ConversationMap /><SkillPracticeBoard snapshot={skillDemo} chatId="chat" level="zero" busy={false} /></>}
        {map && <SkillTreeView snapshot={skillDemo} demonstration={true} refresh={() => undefined} save={async () => { throw new Error('Browsing must not save') }} saving={false} onPractice={() => setInMap(false)} />}
      </DraftAssistanceContext>
    </PracticeContext>
  </SkillEvidenceContext></TopicNotesProvider>
}
it('shares one explanation across card and detail and carries the selected skill into Skills without losing the draft', async () => {
  HTMLDialogElement.prototype.showModal = function (): void { this.open = true }
  HTMLDialogElement.prototype.close = function (): void { this.open = false }
  backend.invoke.mockResolvedValue({ explanation: 'Use a demonstrative to identify which object.', example: 'Ese café.', translation: 'That coffee.' })
  render(<ReadingPreferencesContext value={{ autoTranslate: true, alwaysPronunciation: false, alwaysRomanize: false }}><SkillNavigationProvider><Journey /></SkillNavigationProvider></ReadingPreferencesContext>)
  expect(backend.invoke).not.toHaveBeenCalled()
  const card = screen.getByRole('button', { name: /Identify a referent.*XP/ })
  fireEvent.click(card)
  await screen.findByText('That coffee.')
  expect(backend.invoke).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Use this example' }))
  expect(screen.getByRole('textbox', { name: 'Draft' })).toHaveValue('My draft Ese café.')
  fireEvent.click(screen.getByRole('button', { name: /Explanation & reviewed replies/ }))
  const detail = screen.getByRole('dialog')
  expect(within(detail).getByText('That coffee.')).toBeVisible()
  expect(backend.invoke).toHaveBeenCalledTimes(1)
  fireEvent.click(within(detail).getByRole('button', { name: 'Explore on map' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByRole('combobox', { name: 'Inspect' })).toHaveValue('referent')
  expect(screen.getByRole('textbox', { name: 'Draft' })).toHaveValue('My draft Ese café.')
  expect(backend.invoke).toHaveBeenCalledTimes(1)
})
