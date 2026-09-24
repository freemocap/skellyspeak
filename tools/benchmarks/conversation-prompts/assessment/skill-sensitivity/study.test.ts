import test from 'node:test';import assert from 'node:assert/strict';
import {makePlan}from'./plan.ts';import{makePlan as old}from'../skill-pilot/plan.ts';
test('Spanish-only study varies descriptions, preserving baseline, labels, shared framing and case assignments',()=>{
 const p=makePlan(),b=old().jobs.find(j=>j.arm==='B')!.payload.questions;
 assert.equal(p.cases.length,36);assert.equal(p.jobs.length,900);assert.ok(p.reservation<p.dollarCap);
 for(const c of p.cases){assert.equal(c.language,'Spanish');for(const arm of 'ABCDE')assert.equal(p.jobs.filter(j=>j.caseId===c.id&&j.arm===arm).length,5);}
 for(const j of p.jobs){for(const [id,q]of Object.entries<any>(j.payload.questions)){assert.deepEqual(q.criteria,b[id].criteria);if(j.arm==='B')assert.deepEqual(q,b[id]);}assert.ok(!Object.hasOwn(j.payload.state,'targets'));assert.ok(!Object.hasOwn(j.payload,'temperature'));}
 assert.equal(new Set(p.jobs.map(j=>j.id)).size,900);
});
import {transitions}from'../skill-expanded/dashboard/transitions.ts';
test('transition counts expose offsetting fixes and regressions with unchanged net agreement',()=>{
 const cs=[{id:'1',cluster:'1',focal:'x',targets:{x:{evidence:'yes'}}},{id:'2',cluster:'2',focal:'x',targets:{x:{evidence:'yes'}}}];
 const rs=cs.flatMap(c=>[...'ABCDE'].flatMap(arm=>[1,2,3,4,5].map(repeat=>({caseId:c.id,arm,repeat,answers:{x__evidence:{choice:(arm==='B'?c.id==='1':c.id==='2')?'yes':'no'}}}))));
 const result=transitions(cs,rs,'evidence',100);assert.equal(result[0].changed,10);assert.equal(result[0].fixed,5);assert.equal(result[0].broken,5);assert.deepEqual(result[0].ci,[1,1]);
});
