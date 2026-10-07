// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { GuideActions, GuideActionContext } from './GuideActions'
import { GuideDocument } from './GuideDocument'

const guide = { language: 'spanish', variety: 'spanish-spain', skillId: 'time_events', editionLanguage: 'english', fingerprint: 'source-revision' }

it('sends a typed source reference once and exposes failures without retrying', async () => {
  let reject!: (error: Error) => void
  const run = vi.fn(() => new Promise<void>((_, fail) => { reject = fail }))
  render(<GuideActionContext value={run}><GuideActions guide={guide} /></GuideActionContext>)
  fireEvent.click(screen.getByRole('button', { name: 'Ask coach' }))
  expect(screen.getByRole('button', { name: 'Ask coach' })).toBeDisabled()
  expect(run).toHaveBeenCalledExactlyOnceWith({ kind: 'coach', guide, text: 'Explain this skill.' })
  reject(new Error('The guide changed.'))
  expect(await screen.findByRole('alert')).toHaveTextContent('The guide changed.')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Ask coach' })).toBeEnabled())
  expect(run).toHaveBeenCalledOnce()
})

it('offers example starts only for exact authored quotations', async () => {
  const run = vi.fn().mockResolvedValue(undefined)
  render(<GuideActionContext value={run}><GuideDocument text={'# Guide\n\n> cafe\u0301\n\n> café'} context={{ reference: guide, subskills: [], examples: ['cafe\u0301'] }} /></GuideActionContext>)
  expect(screen.queryByRole('button', { name: 'Start with this sentence' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
  const actions = screen.getAllByRole('button', { name: 'Start with this sentence' })
  expect(actions).toHaveLength(1)
  fireEvent.click(actions[0])
  await waitFor(() => expect(run).toHaveBeenCalledExactlyOnceWith({ kind: 'example', guide, example: 0 }))
})

it('keeps a section action tied to its subskill identity', async () => {
  const run = vi.fn().mockResolvedValue(undefined)
  render(<GuideActionContext value={run}><GuideDocument text={'# Events\n\n### Past events\n\nAn explanation.'} context={{ reference: guide, subskills: ['past_events'], examples: [] }} /></GuideActionContext>)
  fireEvent.click(screen.getByRole('button', { name: 'Start conversation' }))
  await waitFor(() => expect(run).toHaveBeenCalledExactlyOnceWith({ kind: 'skill', guide, subskillId: 'past_events' }))
})

it('asks about the selected example or subskill, independently of conversation starts', async () => {
  const run = vi.fn().mockResolvedValue(undefined)
  const view = render(<GuideActionContext value={run}><GuideActions guide={guide} example={2} /></GuideActionContext>)
  fireEvent.click(screen.getByRole('button', { name: 'Explain this sentence' }))
  await waitFor(() => expect(run).toHaveBeenLastCalledWith({ kind: 'coach', guide, text: 'Explain this selection.', focus: { kind: 'example', index: 2 } }))
  view.rerender(<GuideActionContext value={run}><GuideActions guide={guide} subskill="past_events" /></GuideActionContext>)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Ask coach' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Ask coach' }))
  await waitFor(() => expect(run).toHaveBeenLastCalledWith({ kind: 'coach', guide, text: 'Explain this selection.', focus: { kind: 'subskill', subskillId: 'past_events' } }))
})


it('retains a pending sentence action and its failure across menu dismissal', async () => {
  let reject!: (error: Error) => void
  const run = vi.fn(() => new Promise<void>((_, fail) => { reject = fail }))
  render(<GuideActionContext value={run}><GuideDocument text={'# Guide\n\n> Hola'} context={{ reference: guide, subskills: [], examples: ['Hola'] }} /></GuideActionContext>)
  const trigger = screen.getByRole('button', { name: 'More actions' })
  fireEvent.click(trigger)
  fireEvent.click(screen.getByRole('button', { name: 'Start with this sentence' }))
  fireEvent.pointerDown(document.body)
  fireEvent.click(trigger)
  expect(screen.getByRole('button', { name: 'Start with this sentence' })).toBeDisabled()
  expect(run).toHaveBeenCalledOnce()
  fireEvent.pointerDown(document.body)
  reject(new Error('Guide reference changed.'))
  fireEvent.click(trigger)
  expect(await screen.findByRole('alert')).toHaveTextContent('Guide reference changed.')
  expect(run).toHaveBeenCalledOnce()
})
