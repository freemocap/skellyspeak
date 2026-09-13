/** Local synthetic speech fixtures; never uses a paid provider or plays audio. */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cases } from './android.ts'
const voices = { es:'Paulina', ar:'Majed', zh:'Tingting' }
const directory = resolve('test-fixtures/speech')
mkdirSync(directory,{recursive:true})
for (const scenario of cases) {
  execFileSync('say',['-v',voices[scenario.language as keyof typeof voices],'-o',resolve(directory,`${scenario.language}.wav`),'--file-format=WAVE','--data-format=LEI16@22050',scenario.text],{stdio:'inherit'})
  const data = readFileSync(resolve(directory,`${scenario.language}.wav`))
  let pcmBytes = 0
  for (let offset = 12; offset + 8 <= data.length;) {
    const size = data.readUInt32LE(offset + 4)
    if (data.toString('ascii',offset,offset+4) === 'data') pcmBytes += size
    offset += 8 + size + (size % 2)
  }
  if (pcmBytes < 22050) throw new Error(`Speech synthesis produced no usable ${scenario.language} audio; fixture generation failed.`)
}
writeFileSync(resolve(directory,'manifest.json'),JSON.stringify({source:'macOS synthetic voices; software-path fixtures, not human speech',cases:cases.map(scenario=>({...scenario,voice:voices[scenario.language as keyof typeof voices]}))},null,2)+'\n')
