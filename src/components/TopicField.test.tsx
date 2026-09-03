// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TopicField } from './TopicField'

const TOPICS = ['Daily routines', 'Food & cooking', 'Travel stories']

function setup(value = '') {
  const onChange = vi.fn()
  const user = userEvent.setup()
  const view = render(<TopicField topics={TOPICS} value={value} onChange={onChange} />)
  const rerenderWith = (next: string) =>
    view.rerender(<TopicField topics={TOPICS} value={next} onChange={onChange} />)
  return { onChange, user, rerenderWith }
}

const box = () => screen.getByLabelText('Custom conversation topic')

describe('picking a preset topic', () => {
  it('applies it straight away', async () => {
    const { onChange, user } = setup()
    await user.selectOptions(screen.getByLabelText('Conversation topic'), 'Food & cooking')
    expect(onChange).toHaveBeenCalledWith('Food & cooking')
  })
})

describe('typing your own topic', () => {
  it('does not apply anything while you type', async () => {
    // The bug this pins: changing the topic steers the LIVE conversation, and
    // committing per keystroke sent the tutor half-written topics — pause
    // while typing "cooking pasta" and it was steered toward "cook".
    const { onChange, user } = setup()
    await user.selectOptions(screen.getByLabelText('Conversation topic'), '__custom__')
    await user.type(box(), 'cooking pasta')
    expect(box()).toHaveValue('cooking pasta')
    expect(onChange).not.toHaveBeenCalledWith('cook')
    expect(onChange).not.toHaveBeenCalledWith('cooking')
    expect(onChange).not.toHaveBeenCalledWith('cooking pasta')
  })

  it('applies it on Enter', async () => {
    const { onChange, user } = setup()
    await user.selectOptions(screen.getByLabelText('Conversation topic'), '__custom__')
    await user.type(box(), 'cooking pasta{Enter}')
    expect(onChange).toHaveBeenCalledWith('cooking pasta')
  })

  it('applies it when you click away, rather than losing it', async () => {
    // Having typed a topic and clicked elsewhere, the surprising outcome is
    // the one where nothing happened.
    const { onChange, user } = setup()
    await user.selectOptions(screen.getByLabelText('Conversation topic'), '__custom__')
    await user.type(box(), 'weekend plans')
    await user.tab()
    expect(onChange).toHaveBeenCalledWith('weekend plans')
  })

  it('applies it from the tick, which is disabled until there is a change', async () => {
    const { onChange, user } = setup()
    await user.selectOptions(screen.getByLabelText('Conversation topic'), '__custom__')
    const apply = screen.getByLabelText('Apply this topic')
    expect(apply).toBeDisabled()

    await user.type(box(), 'sports')
    expect(apply).toBeEnabled()
    await user.click(apply)
    expect(onChange).toHaveBeenCalledWith('sports')
  })

  it('trims what you typed', async () => {
    const { onChange, user } = setup()
    await user.selectOptions(screen.getByLabelText('Conversation topic'), '__custom__')
    await user.type(box(), '   sports   {Enter}')
    expect(onChange).toHaveBeenCalledWith('sports')
  })

  it('abandons the draft on Escape', async () => {
    const { onChange, user } = setup()
    await user.selectOptions(screen.getByLabelText('Conversation topic'), '__custom__')
    await user.type(box(), 'nonsense{Escape}')
    expect(onChange).not.toHaveBeenCalledWith('nonsense')
  })
})

describe('going back to the list', () => {
  it('clears the topic, so a hidden one cannot keep steering', async () => {
    const { onChange, user, rerenderWith } = setup()
    await user.selectOptions(screen.getByLabelText('Conversation topic'), '__custom__')
    await user.type(box(), 'sports{Enter}')
    rerenderWith('sports')

    await user.click(screen.getByLabelText('Back to the topic list'))
    expect(onChange).toHaveBeenLastCalledWith('')
    expect(screen.getByLabelText('Conversation topic')).toBeInTheDocument()
  })
})

describe('opening on a topic that is already set', () => {
  it('starts in the text box when the topic is not a preset', () => {
    setup('something I typed earlier')
    expect(box()).toHaveValue('something I typed earlier')
  })

  it('starts on the dropdown when the topic is a preset', () => {
    setup('Travel stories')
    expect(screen.getByLabelText('Conversation topic')).toHaveValue('Travel stories')
  })

  it('starts on the dropdown when no topic is set', () => {
    setup('')
    expect(screen.getByLabelText('Conversation topic')).toHaveValue('')
  })
})
