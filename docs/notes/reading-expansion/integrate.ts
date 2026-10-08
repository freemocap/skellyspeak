import fs from 'node:fs'
import crypto from 'node:crypto'
// Run only after editorial review of the worker draft and correction tables.
const targets: Record<string,string[]> = {english:['spanish','arabic','french'],spanish:['english','arabic','french'],french:['english','spanish','arabic'],arabic:['english','spanish','french']}
const pilot=JSON.parse(fs.readFileSync('content/reading/preload-pilot.json','utf8'))
const key=(e:any)=>JSON.stringify([e.scope.language,e.scope.variety,e.scope.explanation,e.scope.explanationVariety,e.text])
const existing=new Set(pilot.entries.map(key))
for(const language of process.argv.slice(2)) {
 if(!targets[language]) throw new Error(`Unknown language: ${language}`)
 const file=`docs/notes/reading-expansion/${language}${language==='spanish'?'-common-entries':'-entries'}.json`
 const draft=JSON.parse(fs.readFileSync(file,'utf8'))
 const patches=JSON.parse(fs.readFileSync(`docs/notes/reading-expansion/${language}-root-corrections.json`,'utf8'))
 const provenance=`docs/notes/reading-expansion/${language}-review.md`
 const referencesFile=`docs/notes/reading-expansion/${language}-sources.json`
 const references=fs.existsSync(referencesFile)?JSON.parse(fs.readFileSync(referencesFile,'utf8')):{}
 const seen=new Set<string>()
 const entries=[]
 for(const item of draft) {
   const e=structuredClone(item)
   // This importer supplies word lookups. Multiword seeds need contextual span support.
   const words=[...new Intl.Segmenter(undefined,{granularity:'word'}).segment(e.text)].filter(w=>w.isWordLike)
   if(words.length!==1 || words[0].segment!==e.text) continue
   if(existing.has(key(e))) continue
   if(seen.has(key(e))) throw new Error(`Duplicate: ${key(e)}`)
   seen.add(key(e))
   const correction=patches[`${e.scope.variety}/${e.text}`] ?? patches[e.text] ?? patches[e.text.toLowerCase()]
   if(correction) e.gloss=correction[targets[language].indexOf(e.scope.explanation)]
   e.gloss=e.gloss.replace(/ \([^)]*\)/g,'').replace(/\s*[;؛]\s*/g,' / ').replace(/\s*\/\s*/g,' / ').trim()
   if(!e.gloss || e.gloss.length>100 || /\n|dictionary meaning|verbo omitido|primera persona/i.test(e.gloss)) throw new Error(`Noncompact gloss: ${e.text} ${e.gloss}`)
   e.id=crypto.createHash('sha256').update(key(e)).digest('hex').slice(0,24)
   e.sense='Selected lexical or grammatical alternatives, not sentence-specific analysis.'
   e.sources=[provenance,...(references[`${e.scope.variety}/${e.text}`] ?? [])]
   entries.push(e)
 }
 const output=`content/reading/${language}.json`
 const previous=fs.existsSync(output)?JSON.parse(fs.readFileSync(output,'utf8')):null
 const pkg={schemaVersion:1,id:`reading-${language}-expansion`,version:previous?String(Number(previous.version)+1):'1',license:'AGPL-3.0-or-later',review:'editorially_reviewed',sources:[...new Set(entries.flatMap(e=>e.sources))],entries}
 const text=JSON.stringify(pkg,null,2)+'\n'
 if(Buffer.byteLength(text)>2*1024*1024) throw new Error(`Package exceeds content size limit: ${language}`)
 fs.writeFileSync(output,text)
 console.log(`${language}: ${entries.length} records, ${Buffer.byteLength(text)} bytes`)
}
