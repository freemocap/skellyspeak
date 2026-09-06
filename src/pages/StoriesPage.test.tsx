// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Story } from '../types'
import StoriesPage from './StoriesPage'

const backend = vi.hoisted(() => ({
  getSettings: vi.fn(),
  invoke: vi.fn(),
  reportFault: vi.fn(),
}))

vi.mock('../lib/tauri', () => ({
  getSettings: (...args: unknown[]) => backend.getSettings(...args),
  isTauri: true,
  logInfo: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => backend.invoke(...args),
}))

vi.mock('../lib/faults', () => ({
  reportFault: (...args: unknown[]) => backend.reportFault(...args),
}))

function story(title: string): Story {
  return {
    title,
    paragraphs: [{ tokens: [{ text: 'Bonjour', gloss: 'Hello' }] }],
  }
}

describe('story cache ownership', () => {
  beforeEach(() => {
    localStorage.clear()
    backend.getSettings.mockReset()
    backend.invoke.mockReset()
    backend.reportFault.mockReset()
  })

  it('restores the selected level for the language in Rust settings', async () => {
    localStorage.setItem('skellyspeak_story_level', 'advanced')
    localStorage.setItem('skellyspeak_story_fr-FR_beginner', JSON.stringify(story('Wrong slot')))
    localStorage.setItem('skellyspeak_story_fr-FR_advanced', JSON.stringify(story('Right slot')))
    backend.getSettings.mockResolvedValue({ target_language: 'fr-FR' })

    render(<StoriesPage settingsVersion={0} />)

    expect(await screen.findByRole('heading', { name: 'Right slot' })).toBeInTheDocument()
    expect(screen.queryByText('Wrong slot')).not.toBeInTheDocument()
  })

  it('stores a generated story under the current language and selected level', async () => {
    backend.getSettings.mockResolvedValue({ target_language: 'zh-CN' })
    backend.invoke.mockResolvedValue(story('中级故事'))
    const user = userEvent.setup()

    render(<StoriesPage settingsVersion={0} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'intermediate' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'intermediate' }))

    expect(await screen.findByRole('heading', { name: '中级故事' })).toBeInTheDocument()
    expect(localStorage.getItem('skellyspeak_story_level')).toBe('intermediate')
    expect(localStorage.getItem('skellyspeak_story_zh-CN_intermediate')).toBe(
      JSON.stringify(story('中级故事'))
    )
  })
})
