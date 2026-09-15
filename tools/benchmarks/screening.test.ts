import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checks, validate } from './screening.ts';
import { coachFixture, reactionFixture } from './screening-fixtures.ts';
const glossFixtures = JSON.parse(readFileSync(new URL('../test-fixtures/model-routing/native-gloss-fixtures.json', import.meta.url), 'utf8'));
const glossFixture = glossFixtures[0];
test('schema screening rejects missing/extra keys, wrong types, limits and overlapping alternatives', () => {
  const schema = { type: 'object', required: ['text'], additionalProperties: false,
    properties: { text: { type: 'string', minLength: 1, maxLength: 2 } } };
  assert.ok(validate(schema, { text: 'نعم'.slice(0, 2) }));
  for (const bad of [{}, { text: 1 }, { text: '' }, { text: 'long' }, { text: 'ok', extra: 1 }]) assert.equal(validate(schema, bad), false);
  assert.equal(validate({ oneOf: [{ type: 'string' }, { type: 'string' }] }, 'x'), false);
  assert.throws(() => validate({ type: 'string', pattern: '.' }, 'x'), /Unsupported/);
});
test('a correctly shaped but wrong reaction fails semantic fixture expectations', () => {
  const fixture = reactionFixture;
  assert.deepEqual(checks(fixture, JSON.stringify({ kind: 'confused', interpretation: 'You were unclear.', explanation: 'Clarify the message.' })), []);
  assert.deepEqual(checks(fixture, JSON.stringify({ kind: 'happy', interpretation: 'You were understood.', explanation: 'They liked it.' })), ['reaction-meaning']);
  assert.deepEqual(checks(fixture, 'not JSON'), ['json']);
});
test('source checks reject invented coaching quotes and incomplete gloss coverage', () => {
  const coach = coachFixture;
  assert.deepEqual(checks(coach, JSON.stringify({ meaning_recovered: 'full', items: [{ construct: 'preference', quote: 'Me gusta', outcome: 'demonstrated', error: null, rationale: 'You expressed a preference.' }] })), []);
  assert.ok(checks(coach, JSON.stringify({ meaning_recovered: 'full', items: [{ construct: 'preference', quote: 'invented source', outcome: 'demonstrated', error: null, rationale: 'You expressed a preference.' }] })).includes('quote-not-in-source'));
  const gloss = glossFixture;
  assert.ok(checks(gloss, JSON.stringify({ spans: [{ first: 'g0000', last: 'g0001', kind: 'literal' }] })).includes('span-coverage'));
});

test('mechanical gloss coverage follows native source IDs, including combining-mark gaps', () => {
  for (const fixture of glossFixtures) {
    const ids = fixture.schema.properties.spans.items.oneOf[0].properties.first.enum as string[];
    // Literal spans exercise shape and coverage only, not linguistic acceptance.
    const spans = ids.map(id => ({ first: id, last: id, kind: 'literal' }));
    assert.deepEqual(checks(fixture, JSON.stringify({ spans })), [], fixture.id);
    assert.ok(checks(fixture, JSON.stringify({ spans: spans.slice(1) })).includes('span-coverage'));
    assert.ok(checks(fixture, JSON.stringify({ spans: [...spans, spans[0]] })).includes('span-coverage'));
  }
});

test('Groq portability transform only rewrites unions proved disjoint by required kind', async () => {
  const { groqSchema } = await import('./groq-schema.ts');
  const original = glossFixture.schema;
  const portable = groqSchema(original);
  assert.deepEqual(portable.properties.spans.items.anyOf, original.properties.spans.items.oneOf);
  assert.ok(original.properties.spans.items.oneOf); // Never mutate frozen fixtures.
  const overlapping = { oneOf: [original.properties.spans.items.oneOf[0], original.properties.spans.items.oneOf[0]] };
  assert.throws(() => groqSchema(overlapping), /overlap/);
  assert.throws(() => groqSchema({ oneOf: [{ type: 'string' }, { type: 'number' }] }), /not provably disjoint/);
});

test('simpler Groq gloss grammar retains shape while canonical validation rejects invented IDs', async () => {
  const { groqGlossShape } = await import('./groq-schema.ts');
  const fixture = glossFixture;
  const shape = groqGlossShape(fixture.schema);
  const fabricated = { spans: [{ first: 'invented', last: 'invented', kind: 'literal' }] };
  assert.ok(validate(shape, fabricated)); // Provider grammar no longer repeats source enums.
  assert.equal(validate(fixture.schema, fabricated), false); // Acceptance is unchanged.
  assert.equal(validate(shape, { spans: [{ first: 'g0000', last: 'g0000', kind: 'gloss' }] }), false);
  assert.ok(fixture.schema.properties.spans.items.oneOf[0].properties.first.enum);
});
