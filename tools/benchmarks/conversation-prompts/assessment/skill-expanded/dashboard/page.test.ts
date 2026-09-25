import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
// JSDOM is supplied by the repository's existing UI test dependencies.
import { createRequire } from 'node:module';
const { JSDOM, VirtualConsole } = createRequire(import.meta.url)('jsdom');
import { makePlan } from '../plan.ts';
test('dashboard renders charts, recalculates filters, navigates cases and exposes invalid judgments', async () => {
    const p = makePlan();
    const receipts = p.jobs.map(j => { const c = p.cases.find(c => c.id === j.caseId)!; return { caseId: c.id, arm: j.arm, repeat: j.repeat, elapsedMs: 100 + j.repeat, costUsd: .0001, errors: [], answers: Object.fromEntries(Object.entries<any>(c.targets).flatMap(([s, t]) => Object.entries(t).map(([d, choice]) => [s + '__' + d, { choice, probabilities: { [String(choice)]: 1 } }]))) }; });
    delete receipts[0].answers[p.cases.find(c => c.id === receipts[0].caseId)!.focal + '__evidence'];
    const js = await build({ entryPoints: [new URL('./client.ts', import.meta.url).pathname], write: false, bundle: true, format: 'iife' });
    const html = readFileSync(new URL('./page.html', import.meta.url), 'utf8').replace('/* STUDY_DATA */', JSON.stringify({ cases: p.cases, receipts, totalCost: .27, invalidResponses: 1, planHash: p.hash })).replace('/* APPLICATION */', () => js.outputFiles[0].text);
    const errors: any[] = [];
    const virtualConsole = new VirtualConsole();
    virtualConsole.on('jsdomError', (e: Error) => errors.push(e));
    const dom = new JSDOM(html, { runScripts: 'dangerously', virtualConsole }), d = dom.window.document;
    assert.equal(d.querySelectorAll('svg').length, 5);
    const first=d.getElementById('case') as HTMLSelectElement;first.value=receipts[0].caseId;first.dispatchEvent(new dom.window.Event('change'));assert.match(d.getElementById('case-results')!.textContent!,/Invalid answer/);
    assert.ok(d.getElementById('metrics')!.textContent!.includes('2,700'));
    for (const [id, v] of [['language', 'Arabic · Levantine'], ['skill', 'past_reference'], ['dimension', 'evidence'], ['references', 'uncontested']]) {
        const el = d.getElementById(id) as HTMLSelectElement;
        el.value = v;
        el.dispatchEvent(new dom.window.Event('change'));
    }
    assert.match(d.getElementById('case-detail')!.textContent!, /Arabic · Levantine/);
    assert.ok(!d.querySelector('main')!.innerHTML.includes('NaN'));
    const c = d.getElementById('case') as HTMLSelectElement, old = c.value;
    d.getElementById('next')!.click();
    assert.notEqual(c.value, old);
    d.getElementById('previous')!.click();
    assert.equal(c.value, old);
    assert.deepEqual(errors, []);
    dom.window.close();
});
import {makePlan as sensitivity}from'../../skill-sensitivity/plan.ts';
test('shared dashboard uses sensitivity-study names, scope, prompts and transition table',async()=>{
 const p=sensitivity();
 const receipts=p.jobs.map(j=>{const c=p.cases.find(c=>c.id===j.caseId)!;return{caseId:c.id,arm:j.arm,repeat:j.repeat,elapsedMs:100,costUsd:.0001,errors:[],answers:Object.fromEntries(Object.entries<any>(c.targets).flatMap(([s,t])=>Object.entries(t).map(([d,choice])=>[s+'__'+d,{choice,probabilities:{[String(choice)]:1}}])))};});
 const js=await build({entryPoints:[new URL('./client.ts',import.meta.url).pathname],write:false,bundle:true,format:'iife'});
 const data={cases:p.cases,receipts,totalCost:.09,invalidResponses:0,planHash:p.hash,study:p.study,armNames:p.armNames,model:['test-model'],failures:0,strategies:Object.fromEntries([...'ABCDE'].map(a=>[a,p.jobs.find(j=>j.arm===a)!.payload.questions]))};
 const html=readFileSync(new URL('./page.html',import.meta.url),'utf8').replace('/* STUDY_DATA */',()=>JSON.stringify(data)).replace('/* APPLICATION */',()=>js.outputFiles[0].text);
 const errors:Error[]=[];const vc=new VirtualConsole();vc.on('jsdomError',(e:Error)=>errors.push(e));const dom=new JSDOM(html,{runScripts:'dangerously',virtualConsole:vc}),d=dom.window.document;
 assert.deepEqual(errors,[]);assert.equal(d.querySelector('h1')!.textContent,p.study.title);assert.match(d.getElementById('transitions')!.textContent!,/Changed/);assert.ok(!d.getElementById('method')!.textContent!.includes('108'));assert.match(d.getElementById('table')!.textContent!,/USD \/ request/);assert.match(d.getElementById('quality')!.textContent!,/of 900/);assert.ok(!d.querySelector('main')!.innerHTML.includes('NaN'));dom.window.close();
});
import{makePlan as strategies}from'../../skill-strategies/plan.ts';
test('eight-arm dashboard defaults to fresh unflagged cases and keeps all rows within chart bounds',async()=>{
 const p=strategies();const receipts=p.jobs.map(j=>{const c=p.cases.find(c=>c.id===j.caseId)!;return{caseId:c.id,arm:j.arm,repeat:j.repeat,elapsedMs:100,costUsd:.0001,errors:[],answers:Object.fromEntries(Object.entries<any>(c.targets).flatMap(([s,t])=>Object.entries(t).map(([d,choice])=>[s+'__'+d,{choice,probabilities:{[String(choice)]:1}}])))};});
 const data={cases:p.cases,receipts,totalCost:.336,invalidResponses:0,planHash:p.hash,study:p.study,armIds:p.armIds,armNames:p.armNames,model:['test'],failures:0,strategies:Object.fromEntries(p.armIds.map(a=>[a,p.jobs.find(j=>j.arm===a)!.payload.questions]))};
 const js=await build({entryPoints:[new URL('./client.ts',import.meta.url).pathname],write:false,bundle:true,format:'iife'});const html=readFileSync(new URL('./page.html',import.meta.url),'utf8').replace('/* STUDY_DATA */',()=>JSON.stringify(data)).replace('/* APPLICATION */',()=>js.outputFiles[0].text);const errors:Error[]=[];const vc=new VirtualConsole();vc.on('jsdomError',(e:Error)=>errors.push(e));const dom=new JSDOM(html,{runScripts:'dangerously',virtualConsole:vc}),d=dom.window.document;
 assert.deepEqual(errors,[]);assert.equal((d.getElementById('cohort')as HTMLSelectElement).value,'fresh');assert.equal((d.getElementById('case')as HTMLSelectElement).options.length,p.cases.filter(c=>c.partition==='fresh'&&!c.contested).length);assert.equal(d.querySelectorAll('#agreement circle').length,8);assert.ok(Number(d.querySelector('#agreement svg')!.getAttribute('viewBox')!.split(' ')[3])>400);d.getElementById('focus')!.click();assert.equal(d.querySelectorAll('#difference circle').length,7);const cohort=d.getElementById('cohort')as HTMLSelectElement;cohort.value='development';cohort.dispatchEvent(new dom.window.Event('change'));assert.equal((d.getElementById('case')as HTMLSelectElement).options.length,p.cases.filter(c=>c.partition==='development'&&!c.contested).length);assert.ok(!d.querySelector('main')!.innerHTML.includes('NaN'));dom.window.close();
});
import {makePlan as multilingual}from'../../skill-multilingual/plan.ts';
test('multilingual report uses all cases, two repeats and separate control with working language filters',async()=>{
 const p=multilingual();const receipts=p.jobs.map(j=>{const c=p.cases.find(c=>c.id===j.caseId)!;return{caseId:c.id,arm:j.arm,repeat:j.repeat,elapsedMs:100,costUsd:.0001,errors:[],answers:Object.fromEntries(Object.entries<any>(c.targets).flatMap(([s,t])=>Object.entries(t).map(([d,choice])=>[s+'__'+d,{choice,probabilities:{[String(choice)]:1}}])))};});
 const data={...p,receipts,totalCost:.23,invalidResponses:0,planHash:p.hash,model:['test'],failures:0,strategiesByLanguage:Object.fromEntries(['es','ar','zh'].map(code=>[code,Object.fromEntries(p.armIds.map(a=>[a,p.jobs.find(j=>j.arm===a&&j.caseId.startsWith(code+'/'))!.payload.questions]))]))};
 const js=await build({entryPoints:[new URL('./client.ts',import.meta.url).pathname],write:false,bundle:true,format:'iife'});const html=readFileSync(new URL('./page.html',import.meta.url),'utf8').replace('/* STUDY_DATA */',()=>JSON.stringify(data)).replace('/* APPLICATION */',()=>js.outputFiles[0].text);const errors:Error[]=[];const vc=new VirtualConsole();vc.on('jsdomError',(e:Error)=>errors.push(e));const dom=new JSDOM(html,{runScripts:'dangerously',virtualConsole:vc}),d=dom.window.document;
 assert.deepEqual(errors,[]);assert.equal(d.querySelectorAll('#agreement circle').length,7);assert.equal(d.getElementById('cohort'),null);assert.equal(d.querySelectorAll('#case option').length,144);assert.match(d.getElementById('metrics')!.textContent!,/2,016/);assert.ok(!d.getElementById('table')!.textContent!.includes('Misleading'));assert.match(d.getElementById('control-results')!.textContent!,/E agreement/);assert.ok(!d.getElementById('case-results')!.textContent!.includes('Repeat 3'));
 for(const language of ['Spanish · Mexico','Arabic · Levantine','Chinese · Mandarin · Simplified']){const el=d.getElementById('language')as HTMLSelectElement;el.value=language;el.dispatchEvent(new dom.window.Event('change'));assert.equal(d.querySelectorAll('#case option').length,48);const ref=d.getElementById('references')as HTMLSelectElement;ref.value='uncontested';ref.dispatchEvent(new dom.window.Event('change'));assert.equal(d.querySelectorAll('#case option').length,40);ref.value='all';ref.dispatchEvent(new dom.window.Event('change'));}
 assert.deepEqual(errors,[]);assert.ok(!d.querySelector('main')!.innerHTML.includes('NaN'));dom.window.close();
});
