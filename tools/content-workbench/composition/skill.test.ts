import test from 'node:test';import assert from 'node:assert/strict';
import{readFileSync}from'node:fs';import{parse}from'yaml';import{compose}from'./skill.ts';
const root=new URL('../../../docs/notes/language-guides-and-xp/drafts/',import.meta.url);
const read=(p:string)=>parse(readFileSync(new URL(p,root),'utf8'));
for(const [skill,guide,variety]of [['past-reference','arabic-past','Levantine'],['possession-relationships','spanish-possession','Mexico']])test(`${variety}: one source renders human guidance and presence-only questions`,()=>{
 const s=read(`skills/${skill}.yaml`),g=read(`languages/${guide}.yaml`),a=read('assessment-presence.yaml'),r=compose(s,g,variety,a);
 assert.ok(r.markdown.includes(g.varieties[variety].examples[0].text));assert.ok(!r.prompt.instructions.includes(g.varieties[variety].examples[0].text));
 assert.ok(r.prompt.instructions.includes(g.core.assessment));assert.ok(r.prompt.instructions.includes(g.varieties[variety].assessment));
 assert.deepEqual(Object.keys(r.prompt.criteria),['absent','contextual','direct','unclear']);
 assert.throws(()=>compose(s,g,'uncovered',a),/No authored coverage/);
 assert.throws(()=>compose({...s,skill:{...s.skill,id:'different'}},g,variety,a),/different skill/);
});
