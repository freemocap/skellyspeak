import { expect, it, vi } from 'vitest'
import { readSelection } from './reading'
const native=vi.hoisted(() => ({invoke:vi.fn()}))
vi.mock('./native',()=>native)
vi.mock('../diagnostics/faults',()=>({reportFault:vi.fn()}))
it('cancels a reservation that arrives after its source was closed and never runs it', async()=>{
  let release!:(id:string)=>void
  native.invoke.mockImplementation((command:string)=>command==='begin_reading'?new Promise(resolve=>{release=resolve}):Promise.resolve())
  const controller=new AbortController()
  const request=readSelection({text:'Hola',language:'spanish',variety:null,explanation:'english',explanationVariety:null,aid:'word_gloss'},controller.signal)
  controller.abort(); release('request-1')
  await expect(request).rejects.toThrow()
  expect(native.invoke).toHaveBeenCalledWith('cancel_reading',{id:'request-1'})
  expect(native.invoke.mock.calls.some(([command])=>command==='run_reading')).toBe(false)
})

it('passes an explicit retry as fresh native work', async () => {
  native.invoke.mockClear()
  native.invoke.mockImplementation((command: string) => Promise.resolve(command === 'begin_reading' ? 'fresh-request' : {}))
  const input = {text:'Hola',language:'spanish',variety:null,explanation:'english',explanationVariety:null,aid:'word_gloss' as const}
  const signal = new AbortController().signal
  await readSelection(input, signal, { retry: true })
  expect(native.invoke).toHaveBeenCalledWith('begin_reading', {input, fresh:true})
  expect(native.invoke).toHaveBeenCalledWith('run_reading', {id:'fresh-request'}, signal)
})
