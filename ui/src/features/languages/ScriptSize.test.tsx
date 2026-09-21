// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useLayoutEffect } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ScriptSize } from './ScriptSize'
import { useSettingsStore } from '../../state/settings/settings'
import type { Settings } from '../../types'

const save = vi.fn()
beforeEach(() => {
  save.mockReset().mockImplementation(async (language: string, scale: number | null) => {
    useSettingsStore.setState({settings:{script_scales:scale === null ? {} : {[language]:scale}} as unknown as Settings})
  })
  useSettingsStore.setState({...useSettingsStore.getInitialState(),settings:{script_scales:{arabic:1.5}} as unknown as Settings,saveScriptScale:save})
})
it('accepts arbitrary decimal scalars without rounding on slider focus', async () => {
  render(<ScriptSize language="arabic" defaultScale={1.5} />)
  const input = screen.getByRole('spinbutton')
  fireEvent.change(input,{target:{value:'1.375'}})
  expect(save).not.toHaveBeenCalled()
  fireEvent.blur(input)
  await waitFor(() => expect(save).toHaveBeenCalledWith('arabic',1.375))
  fireEvent.blur(screen.getByRole('slider'))
  expect(save).toHaveBeenCalledTimes(1)
})
it('preserves an edit made before passive mount effects run', async () => {
  function EarlyEdit() {
    useLayoutEffect(() => {
      fireEvent.change(screen.getByRole('spinbutton'), {target:{value:'1.37'}})
    }, [])
    return <ScriptSize language="arabic" defaultScale={1.5} />
  }
  render(<EarlyEdit />)
  expect(screen.getByRole('spinbutton')).toHaveValue(1.37)
  fireEvent.blur(screen.getByRole('spinbutton'))
  await waitFor(() => expect(save).toHaveBeenCalledExactlyOnceWith('arabic',1.37))
})
it('saves fine slider adjustments on release instead of saving every drag event', async () => {
  render(<ScriptSize language="arabic" defaultScale={1.5} />)
  const slider = screen.getByRole('slider')
  expect(slider).toHaveAttribute('step','0.01')
  fireEvent.change(slider,{target:{value:'1.36'}})
  fireEvent.change(slider,{target:{value:'1.37'}})
  expect(save).not.toHaveBeenCalled()
  expect(screen.getByRole('spinbutton')).toHaveValue(1.37)
  fireEvent.pointerUp(slider)
  await waitFor(() => expect(save).toHaveBeenCalledExactlyOnceWith('arabic',1.37))
})
it('rejects empty or out-of-range input without saving', () => {
  render(<ScriptSize language="arabic" defaultScale={1.5} />)
  const input = screen.getByRole('spinbutton')
  for (const value of ['', '0.4', '3.1']) {
    fireEvent.change(input,{target:{value}})
    fireEvent.blur(input)
    expect(screen.getByRole('alert')).not.toBeEmptyDOMElement()
  }
  expect(save).not.toHaveBeenCalled()
})
