import { expect, it, vi } from 'vitest'
import { readSelection } from './reading'
const native=vi.hoisted(() => ({invoke:vi.fn()}))
vi.mock('./native',()=>native)
vi.mock('../diagnostics/faults',()=>({reportFault:vi.fn()}))
it('cancels a reservation that arrives after its source was closed and never runs it', async()=>{
  let release!:(id:string)=>void
  native.invoke.mockImplementation((command:string)=>command==='begin_reading'?new Promise(resolve=>{release=resolve}):Promise.resolve())
  const controller=new AbortController()
  const request=readSelection({text:'Hola',language:'spanish',variety:null,explanation:'english',explanationVariety:null,speech:false},controller.signal)
  controller.abort(); release('request-1')
  await expect(request).rejects.toThrow()
  expect(native.invoke).toHaveBeenCalledWith('cancel_reading',{id:'request-1'})
  expect(native.invoke.mock.calls.some(([command])=>command==='run_reading')).toBe(false)
})
