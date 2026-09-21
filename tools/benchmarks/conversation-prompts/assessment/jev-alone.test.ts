import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makePlan,questions} from './jev-alone.ts';
import {decodeNouls,call} from './transport.ts';
import {trials,counts} from './sdt.ts';
import type {Row} from './spanish-analysis.ts';
test('matched conditions preserve states, all 45 skills and original requests',()=>{
 const p=makePlan();assert.equal(p.calls,432);assert.equal(new Set(p.jobs.map(j=>j.id)).size,432);
 for(let i=0;i<p.jobs.length;i+=3){const triple=p.jobs.slice(i,i+3);assert.equal(new Set(triple.map(j=>j.arm)).size,3);assert.equal(new Set(triple.map(j=>JSON.stringify(j.payload.state))).size,1);}
 for(const j of p.jobs){assert.equal(j.engine,'jev');assert.equal(Object.keys(j.payload.questions).length,j.arm==='binary'?90:45);assert.equal((j.payload.state as any).currentLearnerMessage,p.cases.find(c=>c.id===j.sourceId)!.text);}
});
test('Noul decoding accepts documented shape and rejects invalid or missing probabilities',()=>{
 const j=makePlan().jobs.find(j=>j.arm==='binary')!;j.payload.questions=questions('binary',[{id:'reason',label:'reason',criterion:'Connect reason'}]);
 assert.deepEqual(decodeNouls({reason__evidence:{type:'noul',noul:.7},reason__full:{type:'noul',noul:.2}},j),{nouls:{reason__evidence:.7,reason__full:.2},errors:[]});
 assert.equal(decodeNouls({reason__evidence:{type:'noul',noul:1.01}},j).errors.length,2);
});
test('binary contradictions stay visible in independent SDT tasks, never repaired',()=>{
 const row={status:'complete',engine:'binary',caseId:'a',reference:{reason:'partial'},predictions:{reason:'contradictory'},probabilities:{},evidenceScores:{reason:{attempt:.2,full:.8}}} as unknown as Row;
 assert.equal(counts(trials([row],'attempt',.5)).miss,1);
 assert.equal(counts(trials([row],'full',.5)).falseAlarm,1);
 assert.equal(counts(trials([row],'full',.9)).correctRejection,1);
});
test('transport retains Noul, billing and pinned model; does not demand Choice confidence',async()=>{
 const j=makePlan().jobs.find(j=>j.arm==='binary')!;
 const response={model:'typesafe/jev-1.13',answers:Object.fromEntries(Object.keys(j.payload.questions).map(id=>[id,{type:'noul',noul:.3}])),usage:{cost:.001,input_tokens:300}};
 const r=await call(j,'fixture-secret',async()=>new Response(JSON.stringify(response),{status:200}) as any);
 assert.equal(r.status,'complete');assert.equal(Object.keys(r.nouls!).length,90);assert.equal(r.metadata?.usage.cost,.001);assert.equal(JSON.stringify(r).includes('fixture-secret'),false);
});
