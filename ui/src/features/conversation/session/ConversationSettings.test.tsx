// @vitest-environment jsdom
import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { I18nProvider } from '../../../components/localization/i18n'
import { LOCALES, t } from '../../../domain/localization'
import type { Settings } from '../../../types'
import { ConversationSettings } from './ConversationSettings'

function Fixture({ settings = null, onToggle = vi.fn(), saving = false }: { settings?: Settings | null; onToggle?: (key: string) => Promise<void>; saving?: boolean }) {
  const [open, setOpen] = useState(false)
  return <ConversationSettings open={open} onOpenChange={setOpen} settings={settings} saving={saving}
    onToggle={onToggle} nativePicker={null} difficulty={null} showRomanization
    exportDisabled onExport={vi.fn()} />
}

it.each(Object.keys(LOCALES))('opens and closes conversation settings in %s without missing messages', locale => {
  render(<I18nProvider locale={locale}><Fixture /></I18nProvider>)
  fireEvent.click(screen.getByRole('button', { name: t(locale, 'Conversation settings') }))
  const panel = screen.getByRole('dialog', { name: t(locale, 'Conversation settings') })
  expect(within(panel).getByText(t(locale, 'Automatically dismiss new XP cards'))).toBeVisible()
  expect(within(panel).getAllByRole('switch')).toHaveLength(7)
  fireEvent.click(within(panel).getByRole('button', { name: t(locale, 'Close') }))
  expect(screen.queryByRole('dialog')).toBeNull()
})


it('exposes the shared XP effects preference under Rewards and reflects saved changes', () => {
  const toggle = vi.fn(async () => {})
  const settings = { xp_effects: true } as Settings
  const view = render(<Fixture settings={settings} onToggle={toggle} />)
  fireEvent.click(screen.getByRole('button', { name: 'Conversation settings' }))
  const rewards = screen.getByRole('region', { name: 'Rewards' })
  const effects = within(rewards).getByRole('switch', { name: /XP effects/ })
  expect(effects).toBeChecked()
  fireEvent.click(effects)
  expect(toggle).toHaveBeenCalledWith('xp_effects')
  view.rerender(<Fixture settings={{ ...settings, xp_effects: false }} onToggle={toggle} />)
  expect(effects).not.toBeChecked()
  view.rerender(<Fixture settings={settings} onToggle={toggle} saving />)
  expect(effects).toBeDisabled()
})
