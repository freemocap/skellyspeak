import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {shortlist,extraction} from './readiness.ts';
import type {Receipt} from './transport.ts';
import type {StudyJob} from './spanish-study.ts';
test('screen uses fixed threshold, stable ties, cap, and refuses failed screens',()=>{
 const r={status:'complete',answers:Object.fromEntries(['f','e','d','c','b','a'].map(id=>[id,{probabilities:{demonstrated:.4,partial:.1}}]))} as unknown as Receipt;
 assert.deepEqual(shortlist(r),['a','b','c','d']);
 assert.deepEqual(shortlist({...r,status:'failed'}),[]);
});
test('extractor restricts criteria and schema without mutating frozen template',()=>{
 const job={request:{messages:[{content:'system'},{content:JSON.stringify({currentLearnerMessage:'Hola',criteria:[{id:'a'},{id:'b'}]})}],response_format:{json_schema:{schema:{properties:{items:{items:{properties:{construct:{enum:['a','b']}}}}}}}}},payload:{questions:{a:{},b:{}}}} as unknown as StudyJob;
 const before=JSON.stringify(job),e=extraction(job,['b']);
 assert.deepEqual(Object.keys(e.payload.questions),['b']);assert.equal(JSON.stringify(job),before);
 assert.deepEqual(JSON.parse((e.request as any).messages[1].content).criteria,[{id:'b'}]);
 assert.throws(()=>extraction(job,[]));
});
test('readiness fixtures have balanced focal labels and new source IDs',()=>{
 const fixture=JSON.parse(readFileSync('tools/benchmarks/conversation-prompts/assessment/readiness-cases.json','utf8'));
 assert.equal(fixture.cases.length,18);assert.equal(new Set(fixture.cases.map((c:any)=>c.id)).size,18);
 for(const group of ['full','partial','absent'])assert.equal(fixture.cases.filter((c:any)=>c.group===group).length,6);
 assert.ok(fixture.cases.every((c:any)=>Object.keys(c.targets).length===1));
});
