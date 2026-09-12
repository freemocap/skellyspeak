// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PartnerReaction } from './PartnerReaction'
import type { PartnerReaction as Reaction } from '../../types'

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function (): void { this.open = true }
  HTMLDialogElement.prototype.close = function (): void { this.open = false }
})
const confused: Reaction = { kind: 'confused', interpretation: 'You are fine because I am tired.', explanation: 'I may have misread your intent. Did you mean to ask why I am tired?' }
const props = { message: 'Estoy bien porque estás cansada.', reply: 'Estoy bien. ¿Tú?', error: undefined, onEdit: undefined }

it('explains this exchange and edits only its learner message without opening other bubble controls', () => {
  const edit = vi.fn()
  const bubble = vi.fn()
  render(<div onClick={bubble} onDoubleClick={bubble}><PartnerReaction {...props} reaction={confused} onEdit={edit} /></div>)
  fireEvent.click(screen.getByRole('button', { name: 'Partner is unsure' }))
  expect(bubble).not.toHaveBeenCalled()
  const dialog = screen.getByRole('dialog')
  expect(dialog).toHaveTextContent(props.message)
  expect(dialog.querySelector('.msg.me')).toHaveTextContent(props.message)
  expect(dialog.querySelector('.msg.bot')).toHaveTextContent(props.reply)
  expect(dialog).toHaveTextContent(confused.interpretation)
  expect(dialog).toHaveTextContent(confused.explanation)
  fireEvent.click(screen.getByRole('button', { name: 'Edit & try again' }))
  expect(edit).toHaveBeenCalledOnce()
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('does not invent a positive reaction when absent or failed', () => {
  const view = render(<PartnerReaction {...props} reaction={undefined} />)
  expect(screen.queryByRole('button')).toBeNull()
  view.rerender(<PartnerReaction {...props} reaction={undefined} error="Reaction request failed" />)
  fireEvent.click(screen.getByRole('button', { name: 'Partner reaction unavailable' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Reaction request failed')
  expect(screen.getByRole('button', { name: 'Edit & try again' })).toBeDisabled()
})

it.each(['understood', 'curious', 'surprised', 'concerned'] as const)('explains a %s reaction and dismisses on outside click', kind => {
  render(<PartnerReaction {...props} reaction={{ kind, interpretation: 'You asked about my work.', explanation: 'I described my shift.' }} />)
  fireEvent.click(screen.getByRole('button'))
  const dialog = screen.getByRole('dialog')
  expect(dialog).toHaveTextContent('Why this reaction')
  expect(dialog).toHaveTextContent('I described my shift.')
  fireEvent.click(dialog, { clientX: -10, clientY: -10 })
  expect(screen.queryByRole('dialog')).toBeNull()
})
