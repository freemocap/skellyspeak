import { beforeEach, expect, it, vi } from 'vitest'
import { speakSelection } from './reading-speech'
import { interruptSpeech, setPlaybackAllowed } from './speech'
const api=vi.hoisted(()=>({read:vi.fn(),play:vi.fn()}))
vi.mock('../ipc/reading',()=>({readSelection:api.read}))
vi.mock('./speech-player',()=>({playSpeechAudio:api.play}))
beforeEach(()=>{vi.clearAllMocks();setPlaybackAllowed(true)})
it('revokes a pending token request when another utterance starts and never plays late audio',async()=>{
  let complete!:(result:unknown)=>void
  api.read.mockImplementation(()=>new Promise(resolve=>{complete=resolve}))
  const result=speakSelection({text:'sí',language:'spanish',variety:null,explanation:'english',explanationVariety:null,aid:'speech'},new AbortController().signal,vi.fn(),1,1)
  const sourceSignal=api.read.mock.calls[0][1] as AbortSignal
  interruptSpeech()
  expect(sourceSignal.aborted).toBe(true)
  complete({audioBase64:'late',receipt:{}})
  await expect(result).rejects.toThrow()
  expect(api.play).not.toHaveBeenCalled()
})
