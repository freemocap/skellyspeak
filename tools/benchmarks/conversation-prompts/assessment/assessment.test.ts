import {test} from 'node:test';
import assert from 'node:assert/strict';
import {outcomes,makePlan,loadStudy,type Job} from './plan.ts';
import {call,decodeAnswers,chatPayload} from './transport.ts';
import {metrics} from './analysis.ts';
const job:Job={id:'fixture',sourceId:'source',sourceTextHash:'hash',language:'spanish',level:'beginner',prompt:'relationship',engine:'jev',condition:'learner',repeat:1,
  payload:{model:'typesafe/jev-1.13',state:{records:[]},questions:{greeting:{type:'choice',instructions:'Greet',criteria:outcomes}}}};
const answer={choice:'not_observed',confidence:1,probabilities:{demonstrated:0,partial:0,not_demonstrated:0,not_observed:1,uncertain:0}};
test('partial validation preserves good answers and rejects missing/invalid distributions',()=>{
  const two={...job,payload:{...job.payload,questions:{...job.payload.questions,courtesy:job.payload.questions.greeting}}};
  const decoded=decodeAnswers({greeting:answer},two);
  assert.equal(decoded.answers.greeting.choice,'not_observed');assert.equal(decoded.errors.length,1);
  assert.equal(decodeAnswers({greeting:{...answer,probabilities:{...answer.probabilities,demonstrated:.9}}},job).errors.length,1);
});
test('failed HTTP retains usage, request ID, valid partial decisions; redacts credentials',async()=>{
  const mock=(async()=>new Response(JSON.stringify({model:job.payload.model,id:'request-1',answers:{greeting:answer},usage:{input_tokens:300,cost:.00001},
    error:{code:429,message:'rate limit SECRET'}}),{status:429,headers:{'x-request-id':'request-2','retry-after':'10'}})) as typeof fetch;
  const result=await call(job,'SECRET',mock);
  assert.equal(result.status,'failed');assert.equal(result.metadata?.usage.cost,.00001);
  assert.equal(result.metadata?.usage.input_tokens,300);assert.equal(result.headers?.['retry-after'],'10');
  assert.equal(result.answers.greeting.choice,'not_observed');assert.ok(!JSON.stringify(result).includes('SECRET'));
});
test('chat control requests every criterion and stops on truncated content',async()=>{
  const chat={...job,engine:'chat' as const,payload:{...job.payload,model:'google/gemini-2.5-flash-lite'}};
  assert.deepEqual(chatPayload(chat).response_format.json_schema.schema.properties.answers.items.properties.id.enum,['greeting']);
  const mock=(async()=>new Response(JSON.stringify({model:chat.payload.model,choices:[{finish_reason:'length',message:{content:JSON.stringify({answers:[{id:'greeting',...answer}]})}}],usage:{cost:.01}}))) as typeof fetch;
  const result=await call(chat,'SECRET',mock);assert.equal(result.status,'failed');assert.equal(result.answers.greeting.confidence,1);
});
test('saved-study sampling preserves origins, isolates role and order, excludes labels and level from state',()=>{
  const path='docs/notes/conversation-prompts/explorer-instruction-language-2026-09-20/study.json';
  const {rows}=loadStudy(path);assert.equal(rows.length,180);
  const skills=[{id:'greeting',label:'Greeting',criterion:'Greet or say goodbye.'}];
  const p=makePlan(path,skills,1,1);
  assert.equal(new Set(p.jobs.map(j=>j.sourceId)).size,9);
  const origin=p.jobs[0].sourceId;
  const pair=p.jobs.filter(j=>j.sourceId===origin&&j.engine==='jev');
  const first=pair.find(j=>j.condition==='evidence-first')!.payload.state as any;
  const last=pair.find(j=>j.condition==='evidence-last')!.payload.state as any;
  assert.deepEqual([...first.records].sort((a,b)=>a.sequence-b.sequence),[...last.records].sort((a,b)=>a.sequence-b.sequence));
  assert.deepEqual((pair.find(j=>j.condition==='partner-only')!.payload.state as any).eligibleIds,[]);
  assert.ok(!JSON.stringify(first).includes('expected'));assert.ok(!Object.hasOwn(first,'level'));
});
test('analysis separates source units, missing costs and paired disagreement',()=>{
  const receipt={id:'a',requestedModel:'test',status:'complete' as const,elapsedMs:10,answers:{greeting:answer},validation:[],validationStage:'answers'};
  const observations=[{job:{...job,condition:'learner'},receipt},
    {job:{...job,id:'b',condition:'reverse-criteria'},receipt:{...receipt,id:'b',metadata:{usage:{cost:.01}},
      answers:{greeting:{...answer,choice:'demonstrated',probabilities:{...answer.probabilities,demonstrated:1,not_observed:0}}}}}];
  const m=metrics(observations);
  assert.equal(m.independentSourceTexts,1);assert.equal(m.missingCosts,1);assert.equal(m.knownCost,.01);
  assert.equal(m.pairs.criteria.length,1);assert.equal(m.pairs.criteria[0].changed,1);
});
