import test from 'node:test';import assert from 'node:assert/strict';import{makePlan}from'./plan.ts';import{hash}from'../skill-pilot/plan.ts';
test('frozen rating study separates future reply from ratings and balances scales, clusters and repeats',()=>{
 const p=makePlan();assert.equal(p.calls,216);assert.equal(p.cases.length,36);assert.equal(new Set(p.cases.map((c:any)=>c.cluster)).size,12);assert.ok(p.reservation<1);
 for(const c of p.cases)for(const arm of ['wide','narrow','reaction']){const js=p.jobs.filter(j=>j.caseId===c.id&&j.arm===arm);assert.equal(js.length,2);assert.equal(hash(js[0].payload),hash(js[1].payload));for(const j of js){assert.ok(!JSON.stringify(j.payload).includes('expected'));if(arm==='reaction')assert.equal(j.payload.state.actualPartnerReply,c.reply);else{assert.ok(!Object.hasOwn(j.payload.state,'actualPartnerReply'));assert.equal(Object.keys(j.payload.questions.grammar.criteria).length,arm==='wide'?12:6);}}}
});
import {normalized,interval} from './analysis.ts';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
test('ordinal normalization and clustered intervals preserve abstention and dependence',()=>{
 assert.equal(normalized('score_1','narrow'),0);assert.equal(normalized('score_5','narrow'),1);assert.equal(normalized('score_10','wide'),1);assert.equal(normalized('insufficient_evidence','wide'),null);assert.equal(interval([]),null);
 assert.deepEqual(interval([{cluster:'a',value:0},{cluster:'a',value:1}]),[.5,.5]);
});
test('built report renders and filters languages, dimensions and case evidence',()=>{
 const {JSDOM,VirtualConsole}=createRequire(import.meta.url)('jsdom');const errors:Error[]=[];const vc=new VirtualConsole();vc.on('jsdomError',(e:Error)=>errors.push(e));
 const dom=new JSDOM(readFileSync('docs/notes/score-scale-2026-09-24/index.html','utf8'),{runScripts:'dangerously',virtualConsole:vc});const d=dom.window.document;
 assert.equal(d.querySelectorAll('#case option').length,36);assert.ok(d.querySelector('#table').textContent.includes('94.4%'));
 const lang=d.querySelector('#language');lang.value='ar';lang.dispatchEvent(new dom.window.Event('change'));assert.equal(d.querySelectorAll('#case option').length,12);assert.ok(d.querySelector('#case-detail').textContent.includes('مبارح'));
 const dimension=d.querySelector('#dimension');dimension.value='conversation';dimension.dispatchEvent(new dom.window.Event('change'));assert.ok(d.querySelector('#distribution').textContent.includes('score_10'));
 assert.equal(d.querySelectorAll('#agreement circle').length,2);assert.equal(errors.length,0);dom.window.close();
});
