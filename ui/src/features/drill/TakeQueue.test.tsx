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
  return <I18nProvider locale="english"><TakeQueue rtl={false} onDelete={() => {}} deleting={false} takes={takes} attempts={attempts} onSelect={() => {}} /></I18nProvider>
}
it('creates the take card at the cut and preserves its element through processing and publication', () => {
  const { rerender } = render(view([take]))
  const card = screen.getByText('Take 1').closest('li')
  expect(screen.getByText('Queued')).toBeInTheDocument()
  rerender(view([{ ...take, state: 'processing' }]))
  expect(screen.getByText('Transcribing…')).toBeInTheDocument()
  expect(screen.getByText('Take 1').closest('li')).toBe(card)
  rerender(view([{ ...take, state: 'completed' }], [attempt]))
  expect(screen.getByText('hola').closest('li')).toBe(card)
  expect(screen.getAllByRole('listitem')).toHaveLength(1)
  expect(screen.queryByText('Transcribing…')).not.toBeInTheDocument()
})
it('leaves a failed take visible without a perpetual processing indicator', () => {
  render(view([{ ...take, state: 'failed' }]))
  expect(screen.getByText('Take failed')).toBeInTheDocument()
  expect(screen.getByRole('article')).toHaveAttribute('aria-busy', 'false')
})

it('separates recognition confidence from similarity using shared status tones', () => {
  const low = { ...attempt, comparison: { ...attempt.comparison, matchRatio: null,
    reliability: { policy: 1, accepted: false, confidence: .2, minimumConfidence: .6, speechSeconds: 1,
      noSpeechProbability: null, source: 'word_logprobs', reason: 'low_confidence' } } }
  const { rerender } = render(view([{ ...take, state: 'completed' }], [low]))
  expect(screen.getByText('Recognition confidence: 20%')).toHaveAttribute('data-tone', 'danger')
  expect(screen.getByText('Not scored')).toBeInTheDocument()
  expect(screen.queryByText('Exact')).toBeNull()
  expect(document.querySelector('.drill-attempt-words')?.childElementCount).toBe(0)
  const high = { ...attempt, comparison: { ...attempt.comparison,
    reliability: { ...low.comparison.reliability, accepted: true, confidence: .9, reason: 'accepted' } } }
  rerender(view([{ ...take, state: 'completed' }], [high]))
  expect(screen.getByText('Recognition confidence: 90%')).toHaveAttribute('data-tone', 'success')
  expect(screen.getByText('100%')).toBeInTheDocument()
})
