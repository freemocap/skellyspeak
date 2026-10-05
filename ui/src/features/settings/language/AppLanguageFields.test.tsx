// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { AppLanguageFields } from './AppLanguageFields'

vi.mock('../../../platform/ipc/tauri', () => ({ languages: () => [
  { code: 'english', base: 'english', label: 'English', name: 'English', defaultVariety: 'english-us', varieties: [{ id: 'english-us', label: 'US' }, { id: 'english-uk', label: 'UK' }] },
  { code: 'spanish', base: 'spanish', label: 'Spanish', name: 'Spanish', defaultVariety: 'spanish-mexico', varieties: [{ id: 'spanish-mexico', label: 'Mexico' }] },
] }))

it('updates interface and explanation together from the primary control', () => {
  const onChange = vi.fn()
  render(<AppLanguageFields value={{ interface_locale: 'english', native_language: 'english', native_variety: 'english-uk' }} onChange={onChange} />)
  fireEvent.change(screen.getByRole('combobox', { name: 'App language' }), { target: { value: 'spanish' } })
  expect(onChange).toHaveBeenCalledExactlyOnceWith({ interface_locale: 'spanish', native_language: 'spanish', native_variety: 'spanish-mexico' })
})

it('keeps an explicit explanation override secondary and preserves a valid variety', () => {
  const onChange = vi.fn()
  const view = render(<AppLanguageFields value={{ interface_locale: 'spanish', native_language: 'english', native_variety: 'english-uk' }} onChange={onChange} />)
  expect(onChange).not.toHaveBeenCalled()
  expect(view.container.querySelector('details')).not.toHaveAttribute('open')
  fireEvent.click(screen.getByText(/Explanation options/))
  fireEvent.change(screen.getByRole('combobox', { name: 'Explain in' }), { target: { value: 'spanish' } })
  expect(onChange).toHaveBeenLastCalledWith({ interface_locale: 'spanish', native_language: 'spanish', native_variety: 'spanish-mexico' })
  fireEvent.change(screen.getByRole('combobox', { name: 'App language' }), { target: { value: 'english' } })
  expect(onChange).toHaveBeenLastCalledWith({ interface_locale: 'english', native_language: 'english', native_variety: 'english-uk' })
})
