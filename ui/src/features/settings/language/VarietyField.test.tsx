// @vitest-environment jsdom
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { I18nProvider } from '../../../components/localization/i18n'
import { VarietyField } from './VarietyField'

const presets = [{ id: 'english-united-states', label: 'United States' }, { id: 'english-united-kingdom', label: 'United Kingdom' }]
function Choices() {
  const [target, setTarget] = useState('english-united-states')
  const [explanation, setExplanation] = useState('english-united-kingdom')
  const [draft, setDraft] = useState('Olá')
  return <><VarietyField presets={presets} value={target} onChange={setTarget} />
    <VarietyField presets={presets} value={explanation} label="Explanation variety" onChange={setExplanation} />
    <input aria-label="Draft" value={draft} onChange={event => setDraft(event.target.value)} /></>
}
it('changes each variety independently without changing the interface locale or draft', async () => {
  const user = userEvent.setup()
  const view = render(<I18nProvider locale="german"><Choices /></I18nProvider>)
  await user.selectOptions(screen.getByRole('combobox', { name: 'Varietät' }), 'english-united-kingdom')
  expect(screen.getByRole('combobox', { name: 'Explanation variety' })).toHaveValue('english-united-kingdom')
  await user.selectOptions(screen.getByRole('combobox', { name: 'Explanation variety' }), 'english-united-states')
  expect(screen.getByRole('combobox', { name: 'Varietät' })).toHaveValue('english-united-kingdom')
  expect(screen.getByRole('textbox')).toHaveValue('Olá')
  view.rerender(<I18nProvider locale="portuguese"><Choices /></I18nProvider>)
  expect(screen.getByRole('combobox', { name: 'Variedade' })).toHaveValue('english-united-kingdom')
  expect(screen.getByRole('textbox')).toHaveValue('Olá')
})
it('shows the named single variety without requiring a selection', () => {
  render(<I18nProvider locale="english"><VarietyField presets={presets.slice(0,1)} value="english-united-states" onChange={() => { throw Error('No choice needed') }} /></I18nProvider>)
  expect(screen.queryByRole('combobox')).toBeNull()
  expect(screen.getByText('United States')).toBeVisible()
})
