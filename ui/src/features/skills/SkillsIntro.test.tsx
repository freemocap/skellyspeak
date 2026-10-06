// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeAll, expect, it, vi } from 'vitest'
import { SkillsIntro } from './SkillsIntro'
import { SkillListView } from './SkillsPage'
import { skillDemo } from '../../domain/learning/catalog/skillDemo'
beforeAll(() => { HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }; HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') } })

it('explains points, levels and the weakest-skill rule, and closes from its button', () => {
  const close = vi.fn()
  render(<SkillsIntro onClose={close} />)
  expect(screen.getByRole('heading', { name: 'How skills work', level: 2 })).toBeVisible()
  expect(screen.getAllByRole('listitem')).toHaveLength(4)
  expect(screen.getByText('Your level is your weakest skill')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
  expect(close).toHaveBeenCalled()
})

it('reopens the explainer from the Skills page header', () => {
  const explain = vi.fn()
  render(<SkillListView languageName="Spanish" snapshot={skillDemo} demonstration refresh={vi.fn()} save={vi.fn()} saving={false} onPractice={vi.fn()} onExplain={explain} />)
  fireEvent.click(screen.getByRole('button', { name: 'How skills work' }))
  expect(explain).toHaveBeenCalled()
})
