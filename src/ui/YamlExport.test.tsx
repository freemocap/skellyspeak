// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { YamlExport } from './YamlExport'
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
})
it('previews literal YAML without downloading or interpreting embedded markup', async () => {
  const view = vi.fn().mockResolvedValue('text: "<script>bad()</script> مرحبا"')
  const save = vi.fn()
  render(<YamlExport title="Conversation YAML" scope="a" view={view} save={save} onClose={() => {}} />)
  expect(view).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'View YAML' }))
  expect(await screen.findByLabelText('Conversation YAML content')).toHaveTextContent('<script>bad()</script> مرحبا')
  expect(document.querySelector('script')).toBeNull()
  expect(save).not.toHaveBeenCalled()
})
it('saves separately and shows native path or a real error', async () => {
  const save = vi.fn().mockRejectedValueOnce(new Error('Write failed')).mockResolvedValueOnce('/Downloads/conversation.yaml')
  render(<YamlExport title="Conversation YAML" scope="a" view={vi.fn()} save={save} onClose={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: 'Save YAML' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Write failed')
  expect(screen.queryByRole('status')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Save YAML' }))
  expect(await screen.findByRole('status')).toHaveTextContent('/Downloads/conversation.yaml')
})
it('clears preview and discards late results when export options or conversation change', async () => {
  let complete!: (value: string) => void
  const view = vi.fn().mockReturnValueOnce(new Promise(resolve => { complete = resolve })).mockResolvedValueOnce('current: true')
  const ui = render(<YamlExport title="Conversation YAML" scope="a:coach" view={view} save={vi.fn()} onClose={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: 'View YAML' }))
  ui.rerender(<YamlExport title="Conversation YAML" scope="b:no-coach" view={view} save={vi.fn()} onClose={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: 'View YAML' }))
  await screen.findByText('current: true')
  complete('private: old')
  await waitFor(() => expect(screen.queryByText('private: old')).toBeNull())
})
