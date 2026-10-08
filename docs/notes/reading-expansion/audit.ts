import fs from 'node:fs'
const inventory=JSON.parse(fs.readFileSync('docs/notes/reading-expansion-inventory.json','utf8'))
const packages=fs.readdirSync('content/reading').filter(f=>f.endsWith('.json')).map(f=>({file:f,...JSON.parse(fs.readFileSync(`content/reading/${f}`,'utf8'))}))
const directions:Record<string,string[]>={english:['spanish','arabic','french'],spanish:['english','arabic','french'],arabic:['english','spanish','french'],french:['english','spanish','arabic']}
const varieties:Record<string,string>={english:'english-united-states',spanish:'spanish-spain',arabic:'arabic-levantine',french:'french-france'}
const index=new Set<string>()
const key=(language:string,variety:string,explanation:string,explanationVariety:string,text:string)=>JSON.stringify([language,variety,explanation,explanationVariety,text])
let records=0
for(const p of packages){
 const ids=new Set<string>()
 if(Buffer.byteLength(JSON.stringify(p))>2*1024*1024) throw new Error(`Oversize package ${p.file}`)
 for(const e of p.entries){
  if(ids.has(e.id))throw new Error(`Duplicate ID ${p.file}: ${e.id}`)
  ids.add(e.id)
  const k=key(e.scope.language,e.scope.variety,e.scope.explanation,e.scope.explanationVariety,e.text)
  if(index.has(k))throw new Error(`Duplicate scope/surface across packages: ${k}`)
  index.add(k)
  if(!e.gloss.trim()|| e.gloss.length>100 || /\n|dictionary meaning|Explain in context/i.test(e.gloss)) throw new Error(`Noncompact gloss ${k}`)
  if(!e.sources.length || e.sources.some((s:string)=>!p.sources.includes(s)))throw new Error(`Missing provenance ${k}`)
  records++
 }
}
const report:any={records,packages:packages.map(p=>({file:p.file,records:p.entries.length,review:p.review})),varieties:[],missing:[]}
for(const [language,vs] of Object.entries(inventory) as [string,any][]){
 for(const [variety,sets] of Object.entries(vs) as [string,any][]){
  const tokens=[...new Set<string>([...sets.principal,...sets.inline])]
  let covered=0
  for(const text of tokens){
   const missing=directions[language].filter(explanation=>!index.has(key(language,variety,explanation,varieties[explanation],text)))
   if(missing.length)report.missing.push({language,variety,text,explanations:missing});else covered++
  }
  report.varieties.push({language,variety,sampleForms:tokens.length,covered})
 }
}
console.log(JSON.stringify(report,null,2))
if(report.missing.length)process.exitCode=1
