// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { ReplyStatus } from './ReplyStatus'

const stream = { generation: 1, attemptId: 'a', conversationId: 'c', turnId: 't', operationId: 'o', kind: 'persona_reply', seq: 3, text: '¡Qué bien! Entonces fu', terminal: null }

it('shows streamed text exactly as it arrived, including partial words', () => {
  const view = render(<ReplyStatus reply={{ state: 'pending', error: null, control: null }} stream={stream} />)
  expect(view.container.querySelector('.reply-received')).toHaveTextContent('¡Qué bien! Entonces fu')
  expect(view.container.querySelector('.is-hydrating')).not.toBeNull()
  expect(view.container.querySelector('.stream-caret')).not.toBeNull()
})

it.each(['failed', 'unknown', 'cancelled'] as const)('keeps received text visible when the reply ends %s', state => {
  const view = render(<ReplyStatus reply={{ state, error: 'Provider stopped', control: null }} retainedText="Texto recibido" />)
  expect(view.container.querySelector('.reply-received')).toHaveTextContent('Texto recibido')
  expect(view.container.querySelector('.stream-caret')).toBeNull()
  expect(screen.getByText('Provider stopped')).toBeInTheDocument()
})
