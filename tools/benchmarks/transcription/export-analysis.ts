/** Export private plot data using the exact workbench scoring implementation. */
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { studyDirectory } from './storage.ts';
import { conditions, score, type Take, type Result } from './experiment.ts';
const directory = studyDirectory();
if (!process.argv[2]) throw Error('Provide a private output directory outside the repository');
const output = resolve(process.argv[2]);
const read = <T>(suffix: string): T[] => readdirSync(directory).filter(f=>f.endsWith(suffix)).map(f=>JSON.parse(readFileSync(join(directory,f),'utf8')));
const takes = read<Take>('.take.json').filter(t=>!t.removedAt).sort((a,b)=>a.created.localeCompare(b.created));
const results = read<Result>('.result.json').sort((a,b)=>a.created.localeCompare(b.created));
const ids = ['whisper-large-v3-forced','scribe-forced-verbatim','scribe-forced-clean','whisper-large-v3-auto','scribe-auto-verbatim','scribe-auto-clean'];
const selected = ids.map(id=>conditions.find(c=>c.id===id)!);
const rows = takes.map((take,index)=>{
  const audioHash=createHash('sha256').update(readFileSync(join(directory,`${take.id}.wav`))).digest('hex');
  if(audioHash!==take.sha256) throw Error(`Audio hash mismatch: ${take.id}`);
  return {takeId:take.id,number:index+1,phraseId:take.phrase.id,meaning:take.phrase.english,language:take.phrase.language,reference:take.reference,variety:take.phrase.variety,
    results:selected.map(condition=>{
      const r=results.find(r=>r.takeId===take.id&&r.condition.id===condition.id);
      if(r&&r.audioSha256!==audioHash) throw Error(`Result audio mismatch: ${r.id}`);
      return {condition:condition.id,resultId:r?.id,status:r?.status??'missing',text:r?.text??'',elapsedMs:r?.elapsedMs??null,cer:r?.status==='ok'?score(take.reference,r.text!,take.phrase.language).cer:null};
    })};
});
mkdirSync(output,{recursive:true,mode:0o700});
writeFileSync(join(output,'plot-data.json'),JSON.stringify({generated:new Date().toISOString(),conditions:selected,rows},null,2),{mode:0o600});
console.log(`Exported ${rows.length} kept takes to ${output}`);
