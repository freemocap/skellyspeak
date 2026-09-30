import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scenarios, families } from './scenarios.ts';
import { partition } from './generate.ts';
import { freezePlan } from './study.ts';

test('every language has all ten distinct semantic situations and review criteria', () => {
  const data = scenarios();
  assert.equal(new Set(data.map(d => d.id)).size, data.length);
  assert.equal(new Set(data.map(d => d.language)).size, 6);
  assert.equal(new Set(data.map(d => d.semanticCaseId)).size, 60);
  for (const language of new Set(data.map(d => d.language))) {
    const rows = data.filter(d => d.language === language && d.encoding === 'authored');
    assert.deepEqual(rows.map(d => d.family), families.map(f => f.id));
    assert.ok(rows.every(d => d.learner.trim() && d.partner.trim() && d.review.trim()));
    assert.ok(rows.find(d => d.family === 'long_context')!.history.length >= 6);
    assert.equal(rows.find(d => d.family === 'transcript')!.modality, 'speech_transcript');
  }
  assert.deepEqual(new Set(data.map(d => d.difficulty)), new Set(['absolute_zero', 'beginner', 'intermediate', 'advanced']));
});
test('canonical variants retain exact changed source and share a semantic case identity', () => {
  const data = scenarios();
  const variants = data.filter(d => d.encoding === 'canonical_variant');
  assert.ok(variants.length >= 3);
  for (const variant of variants) {
    const original = data.find(d => d.id === variant.semanticCaseId)!;
    assert.notEqual(variant.learner, original.learner);
    assert.equal(variant.learner.normalize('NFC'), original.learner.normalize('NFC'));
    assert.deepEqual(variant.history, original.history);
    assert.equal(variant.partner, original.partner);
  }
});
test('batch partition retains real and synthetic provenance without mixing them', () => {
  const groups = partition([{ id: 'real', origin: 'recorded', language: 'spanish' },
    ...scenarios().map(s => ({ ...s, kind: 'persona_reply' }))]);
  assert.equal(groups.size, 7);
  assert.equal(groups.get('recorded')!.length, 1);
  for (const [name, cases] of groups) {
    assert.ok(cases.every(c => c.origin === (name === 'recorded' ? 'recorded' : 'synthetic')));
  }
  assert.throws(() => partition([{ language: 'spanish' }]), /provenance/);
});
test('expanded plans retain the spending ceiling and reject mismatched model pricing', () => {
  const exported = { models: { standard_model: 'standard', fast_model: 'fast' }, cases: [
    { id: 'a', model: 'standard', fastModel: 'fast', payload: { max_tokens: 8192, messages: [] } },
  ] };
  const rates = { standard: { inputRate: 1, outputRate: 1 }, fast: { inputRate: 1, outputRate: 1 } };
  const catalogs = { standard: { model: 'standard', pricing: { prompt: 1, completion: 1 } },
    fast: { model: 'fast', pricing: { prompt: 1, completion: 1 } } };
  assert.throws(() => freezePlan(exported, rates, catalogs), /ceiling|cap/);
  assert.throws(() => freezePlan({ ...exported, models: { standard_model: 'other', fast_model: 'fast' } }, rates, catalogs), /mismatch/);
});
