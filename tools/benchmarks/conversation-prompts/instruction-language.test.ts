import test from 'node:test';
import assert from 'node:assert/strict';
import {instructionLanguageTrials} from './instruction-language.ts';
import {measures} from './explorer/data.ts';
test('instruction-language study isolates matched conditions with balanced repetitions',()=>{
 const trials=instructionLanguageTrials();
 assert.equal(trials.length,180);
 assert.equal(new Set(trials.map(t=>t.id)).size,180);
 for(const language of ['spanish','arabic','mandarin'])for(const level of ['absolute_zero','beginner','intermediate']){
  const pair=trials.filter(t=>t.language===language&&t.level===level);
  const conditions=[...new Set(pair.map(t=>t.variant))];
  assert.equal(conditions.length,2);
  for(const condition of conditions){const cell=pair.filter(t=>t.variant===condition);assert.equal(cell.length,10);assert.equal(new Set(cell.map(t=>t.messages[0].content)).size,1);}
  assert.equal(new Set(pair.map(t=>t.messages[0].content.split('\n').slice(0,2).join('\n'))).size,1);
 }
 assert.ok(trials.every(t=>t.scenario==='no-persona'&&t.messages.length===1));
});
test('metrics handle Arabic vowel marks and Mandarin word segmentation',()=>{
 assert.equal(measures('قِطَّةٌ صَغِيرَةٌ.','ar').words,2);
 assert.ok(measures('我的猫睡着了。你喜欢猫吗？','zh').words>2);
 assert.equal(measures('我的猫睡着了。你喜欢猫吗？','zh').sentences,2);
});
