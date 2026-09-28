// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { I18nProvider } from '../../components/localization/i18n'
import { TakeQueue } from './TakeQueue'
import type { DrillAttemptView, ListeningTake } from '../../generated/contracts'
const take: ListeningTake = { recordingId: 'r1', number: 1, startSeconds: 1, endSeconds: 3, cutSeconds: 4, state: 'queued', failure: null }
const attempt: DrillAttemptView = {
  id: 'a1', visitId: null, transcriptionAttemptId: 'r1', sequence: 1n, transcript: 'hola', createdAt: '2026-09-23T10:00:00Z', audioPrunedAt: null, audioBytes: null,
  comparison: { policy: 'drill-comparison-v1', target: 'hola', transcript: 'hola', normalizations: [], normalizedTarget: 'hola', normalizedTranscript: 'hola', referenceGraphemes: 4, characterErrorRate: 0, edits: 0, matchRatio: 1, scriptNote: 'matches', words: [{ kind: 'same', target: 'hola', transcript: 'hola', similarity: null }] },
}
function view(takes: ListeningTake[], attempts: DrillAttemptView[] = []) {
  return <I18nProvider locale="english"><TakeQueue takes={takes} attempts={attempts} /></I18nProvider>
}
it('keeps the pending card through processing and removes it when the main list owns publication', () => {
  const { rerender } = render(view([take]))
  const card = screen.getByText('Attempt 1').closest('li')
  expect(screen.getByText('Queued')).toBeInTheDocument()
  rerender(view([{ ...take, state: 'processing' }]))
  expect(screen.getByText('Transcribing…')).toBeInTheDocument()
  expect(screen.getByText('Attempt 1').closest('li')).toBe(card)
  rerender(view([{ ...take, state: 'completed' }], [attempt]))
  expect(screen.queryByText('hola')).toBeNull()
  expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  expect(screen.queryByText('Transcribing…')).not.toBeInTheDocument()
})
it('leaves a failed take visible without a perpetual processing indicator', () => {
  render(view([{ ...take, state: 'failed' }]))
  expect(screen.getByText('Attempt failed')).toBeInTheDocument()
  expect(screen.getByRole('article')).toHaveAttribute('aria-busy', 'false')
})

it('omits idle slots and shows only in-flight takes', () => {
  const { rerender } = render(view([]))
  expect(screen.queryByText('No take in progress')).toBeNull()
  expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  rerender(view([take]))
  expect(screen.queryByText('No take in progress')).toBeNull()
  expect(screen.getAllByRole('listitem')).toHaveLength(1)
})
