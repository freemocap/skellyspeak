// @vitest-environment jsdom
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider, useI18n } from '../../../components/localization/i18n'
import { DifficultySelect } from '../../../components/controls/DifficultySelect'
import { languageLabel } from '../../../domain/language/language-label'

function Editor() {
  const tr = useI18n()
  const [draft, setDraft] = useState('')
  return <><input aria-label={tr('Name')} value={draft} onChange={event => setDraft(event.target.value)} /><DifficultySelect value="beginner" saving={false} onChange={async () => {}} /><p>{languageLabel({ code: 'portuguese', name: 'Portuguese', endonym: 'Português' }, tr.locale)}</p><span>{tr.number(1234.5)}</span></>
}
describe('UI locale changes', () => {
  it('updates labels, options and formatting without discarding local input', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<I18nProvider locale="german"><Editor /></I18nProvider>)
    expect(screen.getByRole('combobox', { name: 'Schwierigkeit' })).toHaveValue('beginner')
    expect(screen.getByRole('option', { name: 'Anfänger' })).toBeInTheDocument()
    expect(screen.getByText('Português (Portugiesisch)')).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'João')
    rerender(<I18nProvider locale="portuguese"><Editor /></I18nProvider>)
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('João')
    expect(screen.getByRole('option', { name: 'Iniciante' })).toBeInTheDocument()
    expect(screen.getByText('1.234,5')).toBeInTheDocument()
  })
})
