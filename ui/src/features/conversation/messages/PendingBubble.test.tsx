// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { expect, it } from 'vitest'
import { PendingBubble } from './PendingBubble'

it.each(['me', 'bot'] as const)('holds a %s message’s place with the landed shape, a reading line and a progress footer', side => {
  const view = render(<PendingBubble side={side} text={null} activity={<span>Transcribing…</span>} />)
  const bubble = view.container.querySelector(`.msg.chat-message.${side}`) as HTMLElement
  expect(bubble).toHaveClass('with-actions')
  expect(bubble).toHaveAttribute('aria-busy', 'true')
  expect(bubble.querySelector('.reply-placeholder')).not.toBeNull()
  expect(bubble.querySelector('.message-actions.reply-activity')).toHaveTextContent('Transcribing…')
})

it('fills in text as it arrives, in the same bubble', () => {
  const view = render(<PendingBubble side="me" text={null} activity={null} />)
  const bubble = view.container.querySelector('.msg.me') as HTMLElement
  view.rerender(<PendingBubble side="me" text="Hola" activity={null} />)
  expect(view.container.querySelector('.msg.me')).toBe(bubble)
  expect(bubble.querySelector('.reply-placeholder')).toBeNull()
  expect(bubble.querySelector('.reply-received.target-text')).toHaveTextContent('Hola')
})

it('grows into place only when asked to, so a landed bubble does not replay it', () => {
  const growing = render(<PendingBubble side="me" text={null} activity={null} arriving />)
  expect(growing.container.querySelector('.msg')).toHaveAttribute('data-arriving')
  const landed = render(<PendingBubble side="bot" text={null} activity={null} />)
  expect(landed.container.querySelector('.msg')).not.toHaveAttribute('data-arriving')
})
