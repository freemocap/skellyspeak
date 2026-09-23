// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { ConfigurationRefusal } from './ConfigurationRefusal'
it('blocks startup with the native file error and explains process restart without reset', () => {
  render(<ConfigurationRefusal message="config/languages/ar.yaml: unknown trait abjab" />)
  expect(screen.getByRole('alert')).toHaveTextContent('config/languages/ar.yaml: unknown trait abjab')
  expect(screen.queryByRole('button', { name: /reset/i })).toBeNull()
  expect(screen.getByText('Fix the named configuration file, then quit and reopen SkellySpeak.')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Dismiss error' })).toBeVisible()
})
