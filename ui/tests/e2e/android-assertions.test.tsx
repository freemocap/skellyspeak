// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { completedExchange, disclosureOpened, readDisclosure } from '../../../tools/e2e/assertions'
import { MessageFeedback } from '../../src/features/conversation/coaching/MessageFeedback'
import { SavedGlossText } from '../../src/components/reading/SavedGlossText'
import { ReadingPreferencesContext } from '../../src/components/reading/ReadingPreferences'
import type { CoachDecision, CoachObservationView } from '../../src/generated/contracts'

afterEach(() => vi.restoreAllMocks())

const observation: CoachObservationView = { meaningRecovered: 'full', items: [], candidatesSent: 3, itemsReturned: 0 }
const decision: CoachDecision = { exposedMove: null, repairStatus: null, shown: null, retryInvited: false, fixed: null, alsoNoticed: [], keptGoing: false }

function Exchange({ id, state, reply = true }: { id: string; state: 'complete' | 'pending' | 'unavailable' | 'failed' | 'missing-evidence'; reply?: boolean }) {
  return <div className="turn-stack">
    <div className="msg me" data-reward-message={id}>Hola</div>
    <MessageFeedback id={Number(id)} text="Hola" feedback={state === 'complete' ? observation : undefined}
      decision={state === 'complete' || state === 'missing-evidence' ? decision : undefined}
      error={state === 'failed' ? 'Provider refused' : undefined} reviewing={state === 'pending'} onEdit={undefined} onAsk={() => {}} />
    {reply && <div className="msg bot">Buenas</div>}
  </div>
}

it.each(['pending', 'unavailable', 'failed', 'missing-evidence'] as const)('rejects %s feedback on the newest exchange despite older complete feedback', state => {
  render(<div className="stream"><Exchange id="1" state="complete" /><Exchange id="2" state={state} /></div>)
  expect(completedExchange(document, 2)).toBe(false)
})

it('requires both the newest reply and its completed feedback, with exactly the expected learner count', () => {
  const view = render(<div className="stream"><Exchange id="1" state="complete" /><Exchange id="2" state="complete" reply={false} /></div>)
  expect(completedExchange(document, 2)).toBe(false)
  view.rerender(<div className="stream"><Exchange id="1" state="complete" /><Exchange id="2" state="complete" /></div>)
  expect(completedExchange(document, 2)).toBe(true)
  // The runner sends this exact function body through CDP; it must not depend
  // on module-local helpers that are absent from the page.
  const inPage = new Function('root', `return (${completedExchange.toString()})(root, 2)`)
  expect(inPage(document)).toBe(true)
  expect(completedExchange(document, 1)).toBe(false)
  expect(completedExchange(document, 3)).toBe(false)
})

function Gloss({ alwaysVisible = false }: { alwaysVisible?: boolean }) {
  return <ReadingPreferencesContext value={{ autoTranslate: alwaysVisible, alwaysPronunciation: false, alwaysRomanize: false }}>
    <div className="stream"><div className="msg me" data-reward-message="selected">
      <SavedGlossText text="sí, sí" segments={[{ start: 0, end: 2, kind: 'gloss', gloss: 'yes' }, { start: 4, end: 6, kind: 'gloss', gloss: 'indeed' }]} />
    </div></div>
  </ReadingPreferencesContext>
}

function layout() {
  // jsdom has no layout; mounted glosses get bounds. This tests the assertion's
  // logic and real renderer state, not real browser visibility or hit-testing.
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function (this: HTMLElement) {
    return (this.isConnected && !this.hidden ? [new DOMRect(0, 0, 20, 20)] : []) as unknown as DOMRectList
  })
}

it('accepts only a closed-to-open disclosure on the selected source occurrence', () => {
  layout()
  render(<Gloss />)
  const before = readDisclosure(document, 'selected', '4')!
  expect(before).toMatchObject({ expanded: 'false', meaningVisible: false })
  // A no-op click or a different occurrence must fail, even with a visible gloss.
  expect(disclosureOpened(before, readDisclosure(document, 'selected', '4'))).toBe(false)
  fireEvent.click(screen.getAllByRole('button', { name: 'sí' })[0])
  expect(disclosureOpened(before, readDisclosure(document, 'selected', '4'))).toBe(false)
  expect(disclosureOpened(before, readDisclosure(document, 'selected', '0'))).toBe(false)
  fireEvent.click(screen.getAllByRole('button', { name: 'sí' })[1])
  expect(disclosureOpened(before, readDisclosure(document, 'selected', '4'))).toBe(true)
  const inPage = new Function('root', 'before', `return (${disclosureOpened.toString()})(before, (${readDisclosure.toString()})(root, 'selected', '4'))`)
  expect(inPage(document, before)).toBe(true)
})

it('rejects meanings already visible before the click', () => {
  layout()
  render(<Gloss alwaysVisible />)
  const before = readDisclosure(document, 'selected', '4')!
  expect(before.meaningVisible).toBe(true)
  fireEvent.click(screen.getAllByRole('button', { name: 'sí' })[1])
  expect(disclosureOpened(before, readDisclosure(document, 'selected', '4'))).toBe(false)
})

it('rejects missing or hidden selected meanings after expansion', () => {
  layout()
  render(<Gloss />)
  const before = readDisclosure(document, 'selected', '4')!
  fireEvent.click(screen.getAllByRole('button', { name: 'sí' })[1])
  screen.getByText('indeed').hidden = true
  expect(disclosureOpened(before, readDisclosure(document, 'selected', '4'))).toBe(false)
  expect(disclosureOpened(before, readDisclosure(document, 'other-message', '4'))).toBe(false)
})
