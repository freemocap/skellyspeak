import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hash} from './plan.ts';
import {variants} from './span-variants.ts';
import {loadVariants} from './span-variants-analysis.ts';
const directory='docs/notes/conversation-prompts/jev-span-variants-2026-09-21';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
test('factorial changes only system prompt and model, preserving paired source and native validation',()=>{
 const root=read(directory+'/plan.json'),parent=read(root.parent+'/plan.json');
 assert.equal(root.calls,436);assert.equal(variants.length,8);
 for(const v of variants.filter(v=>['checklist','examples'].includes(v.prompt))){const p=read(directory+'/'+v.id+'/plan.json');
  assert.equal(hash(JSON.stringify(p.jobs)),p.fixtureSha256);assert.deepEqual(p.sourceHashes,parent.sourceHashes);
  assert.equal(p.jobs.length,120);
  for(const [i,j] of p.jobs.entries()){
   assert.equal(j.id,parent.jobs[i].id);assert.deepEqual(j.payload.state,parent.jobs[i].payload.state);
   if(j.skipped)continue;
   const old=parent.jobs[i].request;
   assert.deepEqual({...j.request,model:old.model,messages:old.messages},old);
   assert.deepEqual(j.request.messages.slice(1),old.messages.slice(1));
   assert.equal(j.request.messages[0].content,v.system);
  }
 }
});
test('comparison retains one baseline, all candidate rows, and distinguishes candidate provenance',()=>{
 const d=loadVariants(directory);
 assert.equal(d.rows.length,720);assert.equal(d.pairs.length,600);assert.equal(d.arms.length,6);
 assert.equal(d.rows.filter(r=>r.engine==='chat_model').length,120);
 assert.equal(new Set(d.pairs.map(p=>`${p.row.engine}/${p.row.id}`)).size,600);
 assert.equal(d.arms[0].summary.complete,113);
 assert.equal(d.arms[1].summary.complete,41);
});

test('additional prompts preserve the same paired native contract and combined view includes all eight conditions',()=>{
 const extra=directory.replace('span-variants','span-additional');
 const p=read(extra+'/plan.json');assert.equal(p.calls,436);
 for(const id of p.variants){const plan=read(extra+'/'+id+'/plan.json');const original=read(plan.previous+'/plan.json');
  assert.equal(plan.jobs.length,120);assert.equal(hash(JSON.stringify(plan.jobs)),plan.fixtureSha256);
  assert.equal(plan.previousHash,original.fixtureSha256);
  assert.ok(plan.jobs.filter((j:any)=>!j.skipped).every((j:any)=>j.request.messages[0].content===variants.find(v=>v.id===id)!.system));
 }
 const combined=loadVariants(directory.replace('span-variants','span-comparison'));
 assert.equal(combined.rows.length,1200);assert.equal(combined.pairs.length,1080);assert.equal(combined.arms.length,10);
 assert.equal(new Set(combined.pairs.map(p=>`${p.row.engine}/${p.row.id}`)).size,1080);
});
