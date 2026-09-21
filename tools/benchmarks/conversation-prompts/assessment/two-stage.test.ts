import {test} from 'node:test';
import assert from 'node:assert/strict';
import {totalCost,quoteOverlap,delivered,loadTwoStage} from './two-stage-analysis.ts';
import type {Row} from './spanish-analysis.ts';
import {call} from './transport.ts';
import type {Job} from './plan.ts';
test('missing billed cost is unknown, deliberate skipped calls add zero',()=>{
 assert.equal(totalCost(.1,null,false),null);assert.equal(totalCost(null,.2,false),null);
 assert.equal(totalCost(.1,null,true),.1);assert.ok(Math.abs(totalCost(.1,.2,false)!-.3)<1e-9);
});
test('failed positive pipelines count as delivered misses, never disappear from denominator',()=>{
 const base={caseId:'case',predictions:{question:'demonstrated'},reference:{question:'demonstrated'},probabilities:{}};
 const s=delivered([{...base,status:'complete'},{...base,status:'failed'},{...base,status:'pending'}] as unknown as Row[],'attempt');
 assert.equal(s.hit,1);assert.equal(s.miss,1);assert.equal(s.positives,2);
});
test('quote overlap is source-bound character coverage, not semantic correctness',()=>{
 assert.equal(quoteOverlap('Hola mundo','Hola','Hola mundo'),.4);
 assert.equal(quoteOverlap('Hola mundo','Hola','mundo'),0);
 assert.equal(quoteOverlap('Hola','invented','Hola'),null);
});
test('span transport retains raw candidates for native replay without scoring as assessment decisions',async()=>{
 const job={id:'span',engine:'sparse',outputFormat:'spans',payload:{model:'google/gemini-2.5-flash-lite',state:{currentLearnerMessage:'Hola'},questions:{question:{type:'choice'}}},request:{model:'google/gemini-2.5-flash-lite'}} as unknown as Job;
 const fetcher=(async()=>new Response(JSON.stringify({model:job.payload.model,usage:{cost:.0001},choices:[{finish_reason:'stop',message:{content:JSON.stringify({items:[{construct:'question',quote:'Hola'}]})}}]}),{status:200})) as typeof fetch;
 const r=await call(job,'test-key',fetcher);assert.equal(r.status,'complete');assert.deepEqual(r.nativeOutput,{items:[{construct:'question',quote:'Hola'}]});assert.deepEqual(r.answers,{});
});
test('saved paired study retains every pipeline and confirms native replay failures',()=>{
 const data=loadTwoStage('docs/notes/conversation-prompts/jev-two-stage-2026-09-21');
 assert.equal(data.pairs.length,120);assert.equal(data.complete,true);
 assert.equal(data.arms.find(a=>a.engine==='jev_fast')!.summary.complete,41);
 assert.equal(data.arms.find(a=>a.engine==='chat_model')!.summary.complete,113);
 assert.equal(data.extractionCalls,109);assert.equal(data.reviewedSemanticQuotes,0);
});
