// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { CrashBoundary } from './CrashBoundary'
const logDiagnostic = vi.hoisted(() => vi.fn().mockResolvedValue(true))
vi.mock('../platform/diagnostics/log', () => ({ logDiagnostic }))
it('keeps a scrubbed render failure visible and persists details when the shell crashes', async () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  function Broken(): never { throw new Error('Language picker render failed; api_key=private-key') }
  try {
    render(<CrashBoundary><Broken /></CrashBoundary>)
    expect(screen.getByRole('alert')).toHaveTextContent('Language picker render failed')
    expect(screen.getByRole('alert')).not.toHaveTextContent('private-key')
    expect(screen.getByRole('button', { name: 'Reload app' })).toBeInTheDocument()
    await waitFor(() => expect(logDiagnostic).toHaveBeenCalled())
    expect(JSON.stringify(logDiagnostic.mock.calls)).toContain('Language picker render failed')
    expect(JSON.stringify(logDiagnostic.mock.calls)).not.toContain('private-key')
  } finally { consoleError.mockRestore() }
})
