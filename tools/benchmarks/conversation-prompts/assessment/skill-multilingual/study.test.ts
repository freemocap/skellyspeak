import test from'node:test';import assert from'node:assert/strict';import{makePlan}from'./plan.ts';import{readYaml,hash}from'../skill-pilot/plan.ts';
test('matched multilingual plan preserves Spanish requests, excludes MSA and balances repeats',()=>{
 const p=makePlan(),old=readYaml('docs/notes/language-guides-and-xp/jev-strategies-2026-09-24/plan.yaml');
 assert.equal(p.jobs.length,2304);assert.equal(p.cases.length,144);assert.equal(new Set(p.cases.map(c=>c.cluster)).size,24);assert.deepEqual(p.controlArms,['E']);assert.equal(p.comparisonCount,6);
 for(const code of ['es','ar','zh']){assert.equal(p.cases.filter(c=>c.languageCode===code).length,48);assert.equal(p.cases.filter(c=>c.languageCode===code&&!c.contested).length,40);}
 for(const c of p.cases)for(const a of p.armIds){const jobs=p.jobs.filter(j=>j.caseId===c.id&&j.arm===a);assert.equal(jobs.length,2);assert.equal(hash(jobs[0].payload),hash(jobs[1].payload));if(c.languageCode==='es'){const original=old.jobs.find((j:any)=>j.caseId===c.sourceId&&j.arm===a);assert.equal(hash(jobs[0].payload),hash(original.payload));}if(c.languageCode==='ar')assert.equal(jobs[0].payload.state.variety,'Levantine');}
 for(const j of p.jobs){assert.ok(!Object.hasOwn(j.payload.state,'targets'));assert.ok(!Object.hasOwn(j.payload.state,'sourceId'));assert.notEqual(j.payload.state.variety,'MSA');}
});
