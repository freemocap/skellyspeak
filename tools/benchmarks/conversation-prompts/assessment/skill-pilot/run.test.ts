import test from 'node:test';
import assert from 'node:assert/strict';
import {decode} from './run.ts';
import {makePlan} from './plan.ts';
test('validates per-question choice sets and preserves valid partial answers',()=>{
 const q={a:{criteria:{yes:'',no:''}},b:{criteria:{one:'',two:'',three:''}}};
 const a={choice:'yes',probabilities:{yes:.7,no:.3},confidence:.4};
 assert.deepEqual(decode({a,b:{choice:'yes',probabilities:{yes:1},confidence:1}},q),{answers:{a},errors:['b: invalid labels']});
 assert.equal(decode({a:{...a,probabilities:{yes:1,no:1}}},{a:q.a}).errors.length,1);
 assert.equal(decode({a,extra:a},{a:q.a}).errors.length,1);
});
test('bounded balanced plan keeps references and assistance out of provider inputs',()=>{
 const p=makePlan();assert.equal(p.jobs.length,180);assert.ok(p.reservation<1);
 for(const c of p.cases){const jobs=p.jobs.filter(j=>j.caseId===c.id);assert.equal(jobs.length,10);for(const arm of ['A','B','C','D','E'])assert.equal(jobs.filter(j=>j.arm===arm).length,2);}
 for(const job of p.jobs){assert.equal(Object.keys(job.payload.questions).length,4);assert.ok(!JSON.stringify(job.payload).includes('expected'));assert.ok(!Object.hasOwn(job.payload.state,'attempt_record'));}
});
