// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { OnboardingSetup } from './OnboardingSetup'
import { I18nProvider } from '../../../components/localization/i18n'
import { useOnboardingStore } from '../../../state/settings/onboarding'
import { useSessionStore } from '../../../state/session/session'
import { DEFAULT_APPEARANCE, type Preferences, type ConnectionConfig } from '../../../generated/contracts'

vi.mock('../../../platform/ipc/tauri', () => ({
  languages: () => ['english', 'spanish'].map(code => ({
    code, name: code, endonym: code, base: code, defaultVariety: `${code}-default`,
    fontScale: 1, direction: 'ltr', languageTag: code.slice(0, 2), romanization: null, transcriptionLanguage: null,
    greeting: { text: `${code}-greeting`, romanized: null },
    partner: { name: `${code}-partner`, romanizedName: null, vibe: ['🌿'] },
    varieties: [{ id: `${code}-default`, label: code }],
  })),
}))
vi.mock('../access/SettingsAccess', () => ({ SettingsAccess: () => <div>Existing access controls</div> }))
const save = vi.fn(), finish = vi.fn(), back = vi.fn()
const initial: Preferences = {
  theme: 'light', appearance: { ...DEFAULT_APPEARANCE }, textSize: 85, textSpacing: 0, highContrast: false,
  interfaceLocale: 'spanish', explanationLanguage: 'spanish', explanationVarietyId: 'spanish-default',
  myLanguages: [], targetVarieties: {}, onboarding: 'not_started', onboardingRequired: true, onboardingLanguage: null, onboardingHelp: false,
}
beforeEach(() => {
  vi.clearAllMocks()
  useOnboardingStore.setState({ preferences: initial, busy: false, saveLanguages: save, finish, back })
  useSessionStore.setState({ connection: { configured: false } as ConnectionConfig })
})
it('starts in the selected interface language and requires a starting language', async () => {
  render(<I18nProvider locale="spanish"><OnboardingSetup /></I18nProvider>)
  expect(screen.getByRole('heading', { name: 'Idiomas' })).toBeInTheDocument()
  const next = screen.getByRole('button', { name: 'Continuar' })
  expect(next).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: /spanish-greeting/ }))
  expect(screen.getByRole('button', { name: /spanish-greeting/ })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(next)
  await waitFor(() => expect(save).toHaveBeenCalledWith(['spanish'], 'spanish', { spanish: 'spanish-default' }, 'spanish', 'spanish'))
})
it('adds several languages with the checkboxes and keeps the card and Start in field on one starting language', async () => {
  render(<OnboardingSetup />)
  const learnEnglish = screen.getByRole('checkbox', { name: 'Aprender english' })
  const learnSpanish = screen.getByRole('checkbox', { name: 'Aprender spanish' })
  expect(learnEnglish).toHaveAttribute('aria-checked', 'false')
  fireEvent.click(learnEnglish)
  fireEvent.click(learnSpanish)
  expect(learnEnglish).toHaveAttribute('aria-checked', 'true')
  // The first language added becomes the start until another is chosen.
  const start = screen.getByRole('combobox', { name: 'Empezar en' })
  expect(start).toHaveValue('english')
  fireEvent.click(screen.getByRole('button', { name: /spanish-greeting/ }))
  expect(start).toHaveValue('spanish')
  fireEvent.change(start, { target: { value: 'english' } })
  expect(screen.getByRole('button', { name: /english-greeting/ })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: /spanish-greeting/ })).toHaveAttribute('aria-pressed', 'false')
  // Removing the starting language moves the start to one still chosen.
  fireEvent.click(learnEnglish)
  expect(start).toHaveValue('spanish')
  fireEvent.click(learnEnglish)
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
  await waitFor(() => expect(save).toHaveBeenCalledWith(['spanish', 'english'], 'spanish', { english: 'english-default', spanish: 'spanish-default' }, 'spanish', 'spanish'))
})
it('names each language in its own script and says who the learner will meet', () => {
  render(<I18nProvider locale="spanish"><OnboardingSetup /></I18nProvider>)
  const choice = screen.getByRole('button', { name: /spanish-greeting/ })
  expect(choice).toHaveTextContent('spanish-greeting')
  expect(choice.querySelector('.language-choice-endonym')).toHaveAttribute('lang', 'sp')
  // The partner is the payoff for choosing, and only appears once one is chosen.
  expect(screen.queryByText(/spanish-partner/)).not.toBeInTheDocument()
  fireEvent.click(choice)
  expect(screen.getByText(/spanish-partner/)).toBeInTheDocument()
})
it('resumes at access and permits deferral without claiming a connection', async () => {
  useOnboardingStore.setState({ preferences: { ...initial, onboarding: 'in_progress' } })
  render(<OnboardingSetup />)
  expect(screen.getByText('Existing access controls')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'Set up later' }))
  await waitFor(() => expect(finish).toHaveBeenCalledWith(true))
})
it('reports save failure and keeps the current screen available for retry', async () => {
  finish.mockRejectedValueOnce(new Error('Workspace changed'))
  useOnboardingStore.setState({ preferences: { ...initial, onboarding: 'in_progress' } })
  render(<OnboardingSetup />)
  fireEvent.click(screen.getByRole('button', { name: 'Set up later' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Workspace changed')
  expect(screen.getByRole('button', { name: 'Set up later' })).toBeEnabled()
})
