import test from 'node:test';
import assert from 'node:assert/strict';
import { dot, measures, project, unit } from './data.ts';
import { spanishPersonaTrials, spanishVariationTrials, variationInstruction } from '../spanish-reset.ts';

test('word counts preserve accents and ignore punctuation without conflating vocabulary', () => {
  assert.equal(measures('¡Hoy hace sol! ¿Salimos?').words, 4);
  assert.equal(measures('Árbol azul. ¿Sí?').opening, 'árbol azul');
  assert.equal(measures('¡Hoy hace sol! ¿Salimos?').sentences, 2);
  assert.equal(measures('¡Hoy hace sol! ¿Salimos?').wordsPerSentence, 2);
});
test('PCA preserves a rank-two space, duplicate coordinates and orthogonal axes', () => {
  const vectors = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 0]].map(unit);
  const result = project(vectors);
  assert.ok(Math.abs(result.variance.reduce((a, b) => a + b, 0) - 1) < 1e-8);
  assert.ok(Math.hypot(...result.xy[0].map((x, i) => x - result.xy[4][i])) < 1e-8);
  const x = result.xy.map(v => v[0]), y = result.xy.map(v => v[1]);
  assert.ok(Math.abs(dot(x, y)) < 1e-8);
  for (let i = 0; i < vectors.length; i++) for (let j = 0; j < vectors.length; j++) {
    const original = Math.hypot(...vectors[i].map((x, k) => x - vectors[j][k]));
    const projected = Math.hypot(...result.xy[i].map((x, k) => x - result.xy[j][k]));
    assert.ok(Math.abs(original - projected) < 1e-7);
  }
  assert.throws(() => unit([0, 0]));
  assert.throws(() => unit([NaN, 1]));
});
test('variety comparison changes only one positive instruction across the same 240 cells', () => {
  const baseline = spanishPersonaTrials(), variation = spanishVariationTrials();
  assert.equal(variation.length, 240);
  for (let i = 0; i < 240; i++) {
    assert.equal(variation[i].id, baseline[i].id);
    assert.equal(variation[i].messages[0].content, baseline[i].messages[0].content + '\n' + variationInstruction);
  }
  assert.doesNotMatch(variationInstruction, /hoy|avoid|ban|weather|coffee|food/i);
});
