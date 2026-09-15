// @vitest-environment jsdom
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { I18nProvider } from '../../components/i18n'
import { VarietyField } from './VarietyField'

const presets = [{ id: 'en-US', label: 'United States' }, { id: 'en-GB', label: 'United Kingdom' }]
function Choices() {
  const [target, setTarget] = useState('en-US')
  const [explanation, setExplanation] = useState('en-GB')
  const [draft, setDraft] = useState('Olá')
  return <><VarietyField presets={presets} value={target} onChange={setTarget} />
    <VarietyField presets={presets} value={explanation} label="Explanation variety" onChange={setExplanation} />
    <input aria-label="Draft" value={draft} onChange={event => setDraft(event.target.value)} /></>
}
it('changes each variety independently without changing the interface locale or draft', async () => {
  const user = userEvent.setup()
  const view = render(<I18nProvider locale="de"><Choices /></I18nProvider>)
  await user.selectOptions(screen.getByRole('combobox', { name: 'Varietät' }), 'en-GB')
  expect(screen.getByRole('combobox', { name: 'Explanation variety' })).toHaveValue('en-GB')
  await user.selectOptions(screen.getByRole('combobox', { name: 'Explanation variety' }), 'en-US')
  expect(screen.getByRole('combobox', { name: 'Varietät' })).toHaveValue('en-GB')
  expect(screen.getByRole('textbox')).toHaveValue('Olá')
  view.rerender(<I18nProvider locale="pt"><Choices /></I18nProvider>)
  expect(screen.getByRole('combobox', { name: 'Variedade' })).toHaveValue('en-GB')
  expect(screen.getByRole('textbox')).toHaveValue('Olá')
})
it('shows the named single variety without requiring a selection', () => {
  render(<I18nProvider locale="en"><VarietyField presets={presets.slice(0,1)} value="en-US" onChange={() => { throw Error('No choice needed') }} /></I18nProvider>)
  expect(screen.queryByRole('combobox')).toBeNull()
  expect(screen.getByText('United States')).toBeVisible()
})
